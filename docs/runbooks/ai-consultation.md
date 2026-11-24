# AI 问诊配置

在运行 Nest 后端的环境中启动兼容 OpenAI Chat Completions 的模型服务。模型应能以本机或局域网的 IPv4 地址从后端访问。

在 `apps/server/.env` 中加入模型清单，模型 ID 可在模型服务中查看。

```dotenv
AI_MODELS_JSON='[{"id":"ollama","name":"本地问诊模型","model":"qwen2.5:7b","baseUrl":"http://127.0.0.1:11434/v1"}]'
```

可在 JSON 数组中添加多个模型。若某个服务需要密钥，在对应条目中加上 `"apiKeyEnv":"AI_MODEL_KEY_OLLAMA"`，再在同一环境中设置 `AI_MODEL_KEY_OLLAMA`。启用或移除模型后重启后端。Docker 中的 127.0.0.1 指应用容器自身，请填应用容器实际能访问的私有 IPv4 地址。基础地址会自动补上 `/chat/completions`。如果填写的地址已以该路径结尾，会直接请求该地址。使用其他完整路径时，将该条目的 `exactEndpoint` 设为 `true`。

部署者也可用 `AI_MODEL_ALLOWED_ENDPOINTS` 批准一个或多个完整请求地址，例如 `http://127.0.0.1:11434/v1/chat/completions`。多个地址以逗号分隔。密钥仍通过 `AI_MODELS_JSON` 对应的模型和地址配置。

登录后打开「设定 → AI 模型设置」，可新增模型或粘贴自定义端点 JSON。导入生成停用草稿，点击「保存设置」后跨设备保留在当前账号。测试与启用要求完整请求地址已经批准。连接测试只发送固定测试文本。启用模型并保存后，可在「AI 问诊」中选用。

问诊时可选择最多五条病程记录。点击「预览将发送的内容」，核对模型、地址和文字，再点击「确认发送」。回复用于整理病程与就诊问题。当前每次请求独立处理，页面不保存问诊历史。

## 本机启动时指定局域网 AI 服务

在项目目录启动，使用实际的 AI 服务 IP、端口和 API 基础路径：

```bat
python start.py --ai-server http://192.168.1.20:11434/v1
```

也可直接传入以 `/chat/completions` 结尾的地址。服务使用其他完整路径时，改用 `--ai-endpoint`，并在模型设定中勾选「使用完整请求地址」。参数可重复传入，每次启动时生效。部署时需要长期保存地址的，可继续使用 `AI_MODEL_ALLOWED_ENDPOINTS`。如同时需要手机访问前端，可追加 `--lan`。
