const integrationsModule = new Module("integrations", async () => {
    const enabled = await isExtensionEnabled() && await isSettingEnabled("integrations", true);
    if (!enabled) return;
    let lobbyType = defineUrlType(window.location.href)
    println(lobbyType)

    if (lobbyType === "stats") {
        await integrationsModule.doAfterNodeAppear('[class*=forecast-statistic-table]', async (node) => {
            let lvlpc = node.querySelector("[class*=level-progress-container]")
            appendTo()
            console.log(node)
        })
    }
//todo селекоторы для слотов, но лучше их на удалёнку вынести, и от туда грузить как ресурс
//todo на стороне сервиса сделать энд поинт для отдачи хтмл ресурсов с баннерами
//todo в этом модуле сделать логику с запросами баннеров, идентификацией страницы, и применением селектора
}, async () => {});