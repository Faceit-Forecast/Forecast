/*
 * Copyright (c) 2025 TerraMiner. All Rights Reserved.
 */

const maps = {
    Dust2: "de_dust2",
    Mirage: "de_mirage",
    Nuke: "de_nuke",
    Ancient: "de_ancient",
    Train: "de_train",
    Inferno: "de_inferno",
    Overpass: "de_overpass"
};

const posCatcherModule = new Module("poscatcher", async () => {
    const enabled = await isExtensionEnabled() && await isSettingEnabled("poscatcher", false);
    if (!enabled) return;
    const matchId = extractMatchId();
    const cookieKey = `${matchId}_poscatched`
    if (getCookie(cookieKey)) return
    let anchorSelector = "[name=info] > div[class*=Overview__Stack] > div[class*=Ready__Container]"
    let mapselector = "[name=info] > div[class*=Overview__Stack] > div > div > div > div:nth-child(4) > div > div[class*=middleSlot] > div > div > span > span"
    let chatSelector = "div[class*=styles__ChatSidebarContainer] > div > div:nth-child(2) > div[class*=ChatSection__ChatContainer] > div > div > div > div > div[class*=styles__MessageInputContainer] > div[class*=styles__InputWrapper] > div > div[class*=StyledTextArea__TextAreaWrapper] > textarea"

    posCatcherModule.doAfterNodeAppear(anchorSelector, () => {
        posCatcherModule.doAfterNodeAppear(mapselector, async (node) => {
            if (getCookie(cookieKey)) return
            const key = node.innerText.trim();
            if (!key) return;
            const mapPick = maps[key];
            if (!mapPick) return
            if (!await isSettingEnabled(`${mapPick}Enabled`, true)) return
            let message = await getSettingValue(`${mapPick}Message`, "")
            if (typeof message !== "string" || message.trim() === "") return
            posCatcherModule.doAfterAllNodeAppear(chatSelector, (chatInput) => {
                if (getCookie(cookieKey)) return
                chatInput.focus();

                const descriptor = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
                descriptor.set.call(chatInput, message);

                chatInput.dispatchEvent(new Event('input', {bubbles: true}));
                chatInput.dispatchEvent(new Event('change', {bubbles: true}));

                chatInput.dispatchEvent(new KeyboardEvent('keydown', {
                    key: 'Enter',
                    code: 'Enter',
                    keyCode: 13,
                    which: 13,
                    bubbles: true
                }));

                chatInput.dispatchEvent(new KeyboardEvent('keyup', {
                    key: 'Enter',
                    code: 'Enter',
                    keyCode: 13,
                    which: 13,
                    bubbles: true
                }));

                setCookie(cookieKey, 1, 1440)
            })
        })
    })
}, async () => {
})