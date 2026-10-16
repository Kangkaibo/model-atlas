# GitHub部署

## 在线网站

将本项目放到自己的GitHub仓库，默认分支使用`main`。在仓库`Settings → Pages → Build and deployment → Source`选择`GitHub Actions`，然后在Actions里运行`Deploy Pages`或推送一次main。

部署工作流检查并上传`dist/`，不会发布数据维护脚本或研究缓存。网页资源采用相对路径，兼容`https://账号.github.io/仓库名/`。以成功部署返回的实际URL为准。

官方说明：[GitHub Pages自定义工作流](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)。

## 离线与源码包

```bash
npm run build
npm run check
npm test
npm run package
```

`artifacts/`包含离线站、独立源码ZIP和SHA256校验文件。只打包明确的公开目录，不包含Git历史、凭据、个人工作区或托管账号配置。

推送`v*`标签时Release工作流会进行同样的检查和打包，再发布GitHub Release。无需为了使用网站下载模型权重。

## Fork

Fork后启用Actions，并按上述步骤启用Pages。首次运行来源检查会使用仓库自带对照；按需修改作者列表和检查周期。Fork的计划任务可能默认未启用，需要在Actions中主动启用。

仓库内的项目链接可用`scripts/set_repository.py --repository 账号/仓库名`更新后再构建。
