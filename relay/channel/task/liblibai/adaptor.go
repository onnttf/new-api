package liblibai

// LiblibAI 任务适配器
//
// 上游：https://api.liblib.tv —— LibLib.tv 视频创作画布的逆向接口。
// 模式：text2video / singleImage2video（mixed2video 暂未实现，等到有用例再补）
// 上游模型固定为 "star-video2"，无论 newapi 这边模型名叫什么。
//
// 仍未覆盖的事项（已知）：
//   1. 没有 OSS 上传逻辑 —— 如果用户传进来的 image URL 不是 LibLib 自家域名，
//      上游是否接受未知。Python 里有 upload_image() 走分片上传，等真实用例
//      出现失败再加。
//   2. webid / atlas / project_id / node_id 硬编码自 Python 那份。换账号
//      如果发现 401/403 再考虑做成 channel 级可配置。
//   3. 计费倍率（按时长 / 分辨率）未覆盖 —— 现在直接走 channel 基础单价。
//      要按时长扣费的话需要 override EstimateBilling。

import (
	"bytes"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay/channel"
	"github.com/QuantumNous/new-api/relay/channel/task/taskcommon"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
	"github.com/pkg/errors"
)

// ============================
// 上游请求结构
// ============================

type requestPayload struct {
	Params    requestParams `json:"params"`
	Metadata  requestMeta   `json:"metadata"`
	Provider  string        `json:"provider"`
	Model     string        `json:"model"`
	TaskType  string        `json:"taskType"`
	RequestId string        `json:"requestId"`
}

type requestParams struct {
	Model          string   `json:"model"`
	Count          int      `json:"count"`
	Ratio          string   `json:"ratio"`
	Resolution     string   `json:"resolution"`
	Duration       int      `json:"duration"`
	EnableSound    string   `json:"enableSound"`
	SearchEnabled  int      `json:"search_enabled"`
	AutoCompliance int      `json:"autoCompliance"`
	TextList       []any    `json:"textList"`
	ImageList      []string `json:"imageList"`
	VideoList      []any    `json:"videoList"`
	AudioList      []any    `json:"audioList"`
	MixedList      []any    `json:"mixedList"`
	InfiniteSwitch int      `json:"infiniteSwitch"`
	ModeType       string   `json:"modeType"`
	Prompt         string   `json:"prompt"`
}

type requestMeta struct {
	NodeId    string `json:"node_id"`
	ProjectId string `json:"project_id"`
}

// ============================
// 上游响应结构
// ============================

type submitResponse struct {
	Code int    `json:"code"`
	Msg  string `json:"msg"`
	Data struct {
		TaskId string `json:"taskId"`
	} `json:"data"`
}

type progressResponse struct {
	Code int             `json:"code"`
	Msg  string          `json:"msg"`
	Data json.RawMessage `json:"data"`
}

// 上游 progress 接口里每个 task 的字段。LibLib 不同状态下字段名略不一致，
// 这里把 video URL 的两个可能字段都收一份。
type taskInfoPayload struct {
	TaskId   string `json:"taskId"`
	Status   string `json:"status"`
	Progress int    `json:"progress"`
	VideoUrl string `json:"videoUrl"`
	Url      string `json:"url"`
	ErrorMsg string `json:"errorMsg"`
	Reason   string `json:"reason"`
}

// ============================
// Adaptor 实现
// ============================

type TaskAdaptor struct {
	taskcommon.BaseBilling

	ChannelType int
	apiKey      string
	baseURL     string
}

func (a *TaskAdaptor) Init(info *relaycommon.RelayInfo) {
	a.ChannelType = info.ChannelType
	a.apiKey = info.ApiKey
	a.baseURL = info.ChannelBaseUrl
	if a.baseURL == "" {
		a.baseURL = "https://api.liblib.tv"
	}
}

func (a *TaskAdaptor) ValidateRequestAndSetAction(c *gin.Context, info *relaycommon.RelayInfo) *dto.TaskError {
	return relaycommon.ValidateBasicTaskRequest(c, info, constant.TaskActionGenerate)
}

func (a *TaskAdaptor) BuildRequestURL(_ *relaycommon.RelayInfo) (string, error) {
	return strings.TrimRight(a.baseURL, "/") + endpointCreate, nil
}

// BuildRequestHeader 设置 LibLib 浏览器侧请求头。token 走自定义 `token` header，
// 不是 Bearer。webid / atlas 是逆向得到的设备层固定值。
func (a *TaskAdaptor) BuildRequestHeader(_ *gin.Context, req *http.Request, _ *relaycommon.RelayInfo) error {
	setLiblibHeaders(req, a.apiKey)
	return nil
}

func setLiblibHeaders(req *http.Request, token string) {
	req.Header.Set("Accept", "application/json, text/plain, */*")
	req.Header.Set("Accept-Language", "zh-CN,zh;q=0.9")
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Origin", "https://www.liblib.tv")
	req.Header.Set("Referer", "https://www.liblib.tv/")
	req.Header.Set("User-Agent", defaultUserAgent)
	req.Header.Set("X-Language", "zh")
	req.Header.Set("token", token)
	req.Header.Set("webid", defaultWebID)
	req.Header.Set("atlas", defaultAtlas)
}

func (a *TaskAdaptor) BuildRequestBody(c *gin.Context, info *relaycommon.RelayInfo) (io.Reader, error) {
	submitReq, err := relaycommon.GetTaskRequest(c)
	if err != nil {
		return nil, err
	}

	payload, err := buildPayload(&submitReq)
	if err != nil {
		return nil, errors.Wrap(err, "build liblibai payload failed")
	}

	// info.UpstreamModelName 用于日志 / 计费时显示。本渠道上游永远是 star-video2。
	info.UpstreamModelName = upstreamModel

	data, err := common.Marshal(payload)
	if err != nil {
		return nil, err
	}
	return bytes.NewReader(data), nil
}

func (a *TaskAdaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (*http.Response, error) {
	return channel.DoTaskApiRequest(a, c, info, requestBody)
}

func (a *TaskAdaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (taskID string, taskData []byte, taskErr *dto.TaskError) {
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		taskErr = service.TaskErrorWrapper(err, "read_response_body_failed", http.StatusInternalServerError)
		return
	}
	_ = resp.Body.Close()

	var sResp submitResponse
	if err := common.Unmarshal(responseBody, &sResp); err != nil {
		taskErr = service.TaskErrorWrapper(
			errors.Wrapf(err, "body: %s", responseBody),
			"unmarshal_response_body_failed",
			http.StatusInternalServerError,
		)
		return
	}
	if sResp.Code != 0 {
		msg := sResp.Msg
		if msg == "" {
			msg = fmt.Sprintf("liblibai upstream code=%d", sResp.Code)
		}
		taskErr = service.TaskErrorWrapperLocal(errors.New(msg), "task_submit_failed", http.StatusBadRequest)
		return
	}
	if sResp.Data.TaskId == "" {
		taskErr = service.TaskErrorWrapperLocal(errors.New("liblibai returned empty taskId"), "invalid_response", http.StatusInternalServerError)
		return
	}

	ov := dto.NewOpenAIVideo()
	ov.ID = info.PublicTaskID
	ov.TaskID = info.PublicTaskID
	ov.CreatedAt = time.Now().Unix()
	ov.Model = info.OriginModelName
	c.JSON(http.StatusOK, ov)

	return sResp.Data.TaskId, responseBody, nil
}

// FetchTask 由后端轮询协程调用。LibLib 的查询是 POST {taskIds:[...]}，
// 与提交是不同的 endpoint 但鉴权方式相同。
func (a *TaskAdaptor) FetchTask(baseUrl, key string, body map[string]any, proxy string) (*http.Response, error) {
	taskID, ok := body["task_id"].(string)
	if !ok || taskID == "" {
		return nil, fmt.Errorf("invalid task_id")
	}

	url := strings.TrimRight(baseUrl, "/") + endpointProgress
	reqBody, err := common.Marshal(map[string]any{
		"taskIds": []string{taskID},
	})
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(reqBody))
	if err != nil {
		return nil, err
	}
	setLiblibHeaders(req, key)

	client, err := service.GetHttpClientWithProxy(proxy)
	if err != nil {
		return nil, fmt.Errorf("new proxy http client failed: %w", err)
	}
	return client.Do(req)
}

func (a *TaskAdaptor) ParseTaskResult(respBody []byte) (*relaycommon.TaskInfo, error) {
	var pResp progressResponse
	if err := common.Unmarshal(respBody, &pResp); err != nil {
		return nil, errors.Wrap(err, "unmarshal progress response failed")
	}
	if pResp.Code != 0 {
		// 上游整个查询失败 —— 标记为失败让上层走退款逻辑。
		return &relaycommon.TaskInfo{
			Code:   pResp.Code,
			Status: model.TaskStatusFailure,
			Reason: pickFirstNonEmpty(pResp.Msg, "liblibai progress query failed"),
		}, nil
	}

	info, err := extractTaskInfo(pResp.Data)
	if err != nil {
		return nil, err
	}
	if info == nil {
		// 上游暂时还没看到这个 task —— 视作排队中。
		return &relaycommon.TaskInfo{
			Status:   model.TaskStatusQueued,
			Progress: taskcommon.ProgressQueued,
		}, nil
	}

	out := &relaycommon.TaskInfo{
		Progress: fmt.Sprintf("%d%%", info.Progress),
	}
	videoUrl := pickFirstNonEmpty(info.VideoUrl, info.Url)

	switch strings.ToUpper(info.Status) {
	case "SUCCESS", "COMPLETED", "FINISHED":
		out.Status = model.TaskStatusSuccess
		out.Progress = "100%"
		out.Url = videoUrl
	case "FAILED", "ERROR", "REJECTED":
		out.Status = model.TaskStatusFailure
		out.Reason = pickFirstNonEmpty(info.ErrorMsg, info.Reason, "liblibai task failed")
	case "PROCESSING", "RUNNING":
		out.Status = model.TaskStatusInProgress
	case "PENDING", "QUEUED", "WAITING":
		out.Status = model.TaskStatusQueued
	default:
		// 进度 > 0 视为进行中（兼容 Python 那边的容错）
		if info.Progress > 0 {
			out.Status = model.TaskStatusInProgress
		} else {
			out.Status = model.TaskStatusQueued
		}
	}
	return out, nil
}

func (a *TaskAdaptor) GetModelList() []string {
	return ModelList
}

func (a *TaskAdaptor) GetChannelName() string {
	return ChannelName
}

// ConvertToOpenAIVideo 实现 channel.OpenAIVideoConverter 接口，
// 用于 GET /v1/video/generations/:task_id 返回 OpenAI 兼容 JSON。
func (a *TaskAdaptor) ConvertToOpenAIVideo(originTask *model.Task) ([]byte, error) {
	ov := dto.NewOpenAIVideo()
	ov.ID = originTask.TaskID
	ov.TaskID = originTask.TaskID
	ov.Status = originTask.Status.ToVideoStatus()
	ov.SetProgressStr(originTask.Progress)
	ov.CreatedAt = originTask.CreatedAt
	ov.CompletedAt = originTask.UpdatedAt
	ov.Model = originTask.Properties.OriginModelName

	// originTask.Data 是上一次轮询时存的上游响应。从里面提取视频 URL / 错误信息。
	if len(originTask.Data) > 0 {
		var pResp progressResponse
		if err := common.Unmarshal(originTask.Data, &pResp); err == nil {
			if info, err := extractTaskInfo(pResp.Data); err == nil && info != nil {
				if url := pickFirstNonEmpty(info.VideoUrl, info.Url); url != "" {
					ov.SetMetadata("url", url)
				}
				if strings.Contains(strings.ToUpper(info.Status), "FAIL") ||
					strings.Contains(strings.ToUpper(info.Status), "ERROR") ||
					strings.Contains(strings.ToUpper(info.Status), "REJECT") {
					ov.Error = &dto.OpenAIVideoError{
						Message: pickFirstNonEmpty(info.ErrorMsg, info.Reason),
					}
				}
			}
		}
	}
	return common.Marshal(ov)
}

// ============================
// helpers
// ============================

func buildPayload(req *relaycommon.TaskSubmitReq) (*requestPayload, error) {
	params := requestParams{
		Model:          upstreamModel,
		Count:          1,
		Ratio:          defaultRatio,
		Resolution:     defaultResolution,
		Duration:       defaultDuration,
		EnableSound:    "on",
		SearchEnabled:  1,
		AutoCompliance: 1,
		TextList:       []any{},
		ImageList:      []string{},
		VideoList:      []any{},
		AudioList:      []any{},
		MixedList:      []any{},
		InfiniteSwitch: 0,
		ModeType:       modeText2Video,
		Prompt:         req.Prompt,
	}

	// duration 优先级：req.Duration > req.Seconds > metadata.duration > default
	if req.Duration > 0 {
		params.Duration = req.Duration
	} else if req.Seconds != "" {
		if d, err := strconv.Atoi(req.Seconds); err == nil && d > 0 {
			params.Duration = d
		}
	}

	// size → ratio + resolution
	if ratio, res, ok := parseSize(req.Size); ok {
		params.Ratio = ratio
		params.Resolution = res
	}

	// metadata 覆盖（最高优先级）
	if v, ok := req.Metadata["ratio"].(string); ok && v != "" {
		params.Ratio = v
	}
	if v, ok := req.Metadata["resolution"].(string); ok && v != "" {
		params.Resolution = v
	}
	if v, ok := req.Metadata["enableSound"].(string); ok && v != "" {
		params.EnableSound = v
	}
	if v, ok := toInt(req.Metadata["search_enabled"]); ok {
		params.SearchEnabled = v
	}
	if v, ok := toInt(req.Metadata["autoCompliance"]); ok {
		params.AutoCompliance = v
	}
	if v, ok := toInt(req.Metadata["duration"]); ok {
		params.Duration = v
	}

	// image-to-video：用户传图就切到 singleImage2video 模式，
	// 并在 prompt 末尾自动补 {{Image 1}} 占位符（如果缺）。
	if len(req.Images) > 0 {
		params.ModeType = modeSingleImage2V
		params.ImageList = append([]string{}, req.Images...)
		if !strings.Contains(params.Prompt, "{{Image") {
			params.Prompt = strings.TrimSpace(params.Prompt)
			if params.Prompt == "" {
				params.Prompt = imagePlaceholder
			} else {
				params.Prompt = params.Prompt + " " + imagePlaceholder
			}
		}
	}

	requestId, err := randomRequestId(16)
	if err != nil {
		return nil, errors.Wrap(err, "generate requestId failed")
	}

	return &requestPayload{
		Params: params,
		Metadata: requestMeta{
			NodeId:    defaultNodeID,
			ProjectId: defaultProjectID,
		},
		Provider:  upstreamModel,
		Model:     upstreamModel,
		TaskType:  "video",
		RequestId: requestId,
	}, nil
}

// parseSize 接受三种格式：
//   "720p" / "1080p" —— 直接当 resolution；ratio 取默认 16:9
//   "1280x720" 等 W×H —— ratio 按比例最接近 16:9 / 4:3 / 1:1 取，
//                        resolution 按 max 边长档位
//   其他 —— 返回 ok=false，让 caller 用默认值
func parseSize(size string) (ratio, resolution string, ok bool) {
	if size == "" {
		return "", "", false
	}
	switch strings.ToLower(size) {
	case "720p":
		return defaultRatio, "720p", true
	case "1080p":
		return defaultRatio, "1080p", true
	}

	parts := strings.Split(strings.ToLower(size), "x")
	if len(parts) != 2 {
		return "", "", false
	}
	w, err1 := strconv.Atoi(parts[0])
	h, err2 := strconv.Atoi(parts[1])
	if err1 != nil || err2 != nil || w <= 0 || h <= 0 {
		return "", "", false
	}

	ratio = closestRatio(w, h)
	if w >= 1920 || h >= 1920 {
		resolution = "1080p"
	} else {
		resolution = "720p"
	}
	return ratio, resolution, true
}

func closestRatio(w, h int) string {
	candidates := []struct {
		name string
		v    float64
	}{
		{"16:9", 16.0 / 9.0},
		{"4:3", 4.0 / 3.0},
		{"1:1", 1.0},
	}
	actual := float64(w) / float64(h)
	best := candidates[0].name
	bestDiff := math.Abs(actual - candidates[0].v)
	for _, c := range candidates[1:] {
		diff := math.Abs(actual - c.v)
		if diff < bestDiff {
			bestDiff = diff
			best = c.name
		}
	}
	return best
}

func toInt(v any) (int, bool) {
	switch x := v.(type) {
	case float64:
		return int(x), true
	case int:
		return x, true
	case int64:
		return int(x), true
	case string:
		if n, err := strconv.Atoi(x); err == nil {
			return n, true
		}
	}
	return 0, false
}

// randomRequestId 生成 n 字符的 hex 字符串，用作 LibLib 幂等键。
func randomRequestId(n int) (string, error) {
	b := make([]byte, (n+1)/2)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b)[:n], nil
}

// extractTaskInfo 同时支持两种 data 形状：
//   {"data": {"<id>": {...}}}     —— map keyed by taskId
//   {"data": [{...}, {...}]}      —— list
// 取第一个非空 task。
func extractTaskInfo(raw json.RawMessage) (*taskInfoPayload, error) {
	if len(raw) == 0 || string(raw) == "null" {
		return nil, nil
	}

	// map 形状
	var dict map[string]taskInfoPayload
	if err := common.Unmarshal(raw, &dict); err == nil && len(dict) > 0 {
		for _, v := range dict {
			info := v
			return &info, nil
		}
	}

	// list 形状
	var list []taskInfoPayload
	if err := common.Unmarshal(raw, &list); err == nil && len(list) > 0 {
		return &list[0], nil
	}

	return nil, nil
}

func pickFirstNonEmpty(vals ...string) string {
	for _, v := range vals {
		if v != "" {
			return v
		}
	}
	return ""
}
