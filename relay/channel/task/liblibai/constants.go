package liblibai

// ModelList 是 LiblibAI 渠道当前支持的、对外暴露的模型 ID 列表。
// 用户在 admin UI 创建 channel 时挂的就是这些名字。
// 上游 LiblibAI 实际只接受 "star-video2"，BuildRequestBody 里硬编码。
var ModelList = []string{
	"seedance",
}

// ChannelName 用于日志和 admin UI 显示。
const ChannelName = "liblibai"

// 上游接口路径（拼到 baseURL 后面）。
const (
	endpointCreate   = "/api/task/generation/create"
	endpointProgress = "/api/task/generation/progress"
)

// LiblibAI 上游内部模型 / provider 名。当前只此一个。
const upstreamModel = "star-video2"

// 设备层 / 会话层固定头。来自逆向 Python 代码里那一份。
// TODO: 如果以后发现换账号会 webid/atlas 变动，把这里改成 channel 级可配置。
const (
	defaultWebID     = "1779096557651fzwksepy"
	defaultAtlas     = "edad23f7-ec43-4aa1-9f41-6e4d9e08ddef"
	defaultProjectID = "cf2121033e314dc783d9af9413f6d568"
	defaultNodeID    = "VIUvd4rbKC"
	defaultUserAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36"
)

// 业务侧默认参数。LiblibAI 当前合法值见 Python 注释：
//   ratio:      "16:9" / "4:3" / "1:1"
//   resolution: "720p" / "1080p"
//   duration:   5 / 10
const (
	defaultRatio      = "16:9"
	defaultResolution = "720p"
	defaultDuration   = 5
)

// 模式枚举（modeType）。
const (
	modeText2Video    = "text2video"
	modeSingleImage2V = "singleImage2video"
	// modeMixed2Video 未在 v1 实现 —— 多输入参考视频，等用例出现再补。
)

// i2v 模式下 prompt 中必须包含的占位符。如果用户没写，BuildRequestBody 自动追加。
const imagePlaceholder = "{{Image 1}}"
