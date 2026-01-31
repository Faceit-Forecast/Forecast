/*
 * Copyright (c) 2025 TerraMiner. All Rights Reserved.
 */

let CHALLENGER_TEMPLATE;
let LEVEL_TEMPLATES;
let ELO_PROGRESS_BAR_TEMPLATE;
let ELO_PROGRESS_BAR_MASTER_TEMPLATE;
let ELO_PROGRESS_BAR_SEPARATED_TEMPLATE;
let LEVEL_PROGRESS_TABLE_TEMPLATE;
let MATCH_COUNTER_ARROW_TEMPLATE;
let MATCH_HISTORY_POPUP_TEMPLATE;
let PLAYER_WINRATE_TABLE_TEMPLATE;
let TEAM_WINRATE_TABLE_TEMPLATE;
let SKILL_LEVELS_INFO_TABLE_TEMPLATE;
let FORECAST_STYLES_TEMPLATE;

function initTemplates() {
    CHALLENGER_TEMPLATE = htmlToElement(CHALLENGER_HTML);
    LEVEL_TEMPLATES = new Map(
        Array.from({length: 20}, (_, i) => [i + 1, generateLevelIcon(i + 1)])
    );
    ELO_PROGRESS_BAR_TEMPLATE = htmlToElement(ELO_PROGRESS_BAR_HTML);
    ELO_PROGRESS_BAR_MASTER_TEMPLATE = htmlToElement(ELO_PROGRESS_BAR_MASTER_HTML);
    ELO_PROGRESS_BAR_SEPARATED_TEMPLATE = htmlToElement(ELO_PROGRESS_BAR_SEPARATED_HTML);
    LEVEL_PROGRESS_TABLE_TEMPLATE = htmlToElement(LEVEL_PROGRESS_TABLE_HTML);
    MATCH_COUNTER_ARROW_TEMPLATE = htmlToElement(MATCH_COUNTER_ARROW_HTML);
    MATCH_HISTORY_POPUP_TEMPLATE = htmlToElement(MATCH_HISTORY_POPUP_HTML);
    PLAYER_WINRATE_TABLE_TEMPLATE = htmlToElement(PLAYER_WINRATE_TABLE_HTML);
    TEAM_WINRATE_TABLE_TEMPLATE = htmlToElement(TEAM_WINRATE_TABLE_HTML);
    SKILL_LEVELS_INFO_TABLE_TEMPLATE = htmlToElement(SKILL_LEVELS_INFO_TABLE_HTML);
    FORECAST_STYLES_TEMPLATE = htmlToElement(FORECAST_STYLES_HTML);
}

function htmlToElement(html) {
    const doc = parser.parseFromString(html.trim(), 'text/html');
    const content = doc.body.firstElementChild || doc.head.firstElementChild;
    const wrapper = document.createElement('div');
    wrapper.appendChild(content);
    return wrapper;
}

const CHALLENGER_HTML = /*language=HTML*/ `<span title="Challenger Rank"
                                                 style="width: 32px; height: 32px; display: inline-block;">
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" height="32" width="32">
        <path fill="#111111" d="M12 24c6.627 0 12-5.373 12-12S18.627 0 12 0 0 5.373 0 12s5.373 12 12 12Z"></path>
        <path fill-rule="evenodd" clip-rule="evenodd"
              d="M5.485 5.007c.461.094.93.243 1.352.39a7.638 7.638 0 011.64-1.186 9.721 9.721 0 00-1.203-.742c-.031-.485-.015-.961.024-1.469A9.934 9.934 0 005.11 3.578c.102.5.211.96.368 1.422l.007.007zm13.397-1.421c-.102.5-.211.96-.367 1.421l-.008.008a9.61 9.61 0 00-1.352.39 7.27 7.27 0 00-1.64-1.187c.375-.265.781-.523 1.203-.742.031-.484.016-.96-.023-1.468a9.861 9.861 0 012.187 1.578zm1.43 4.53c.327-.359.624-.742.905-1.148a9.984 9.984 0 00-1.374-2.328c-.164.477-.344.922-.563 1.352a9.277 9.277 0 00-1.398.203 7.532 7.532 0 011.031 1.742c.46.023.937.086 1.398.18zm1.686 2.875c-.43.266-.859.5-1.288.695v-.008a11.546 11.546 0 00-1.211-.726c.008-.68-.07-1.36-.242-2.016.453.094.914.22 1.359.383.375-.304.726-.64 1.062-1.007a9.98 9.98 0 01.32 2.679zm-2.358 4.124c.481 0 .947-.047 1.445-.117a9.69 9.69 0 00.78-2.585 8.499 8.499 0 01-1.374.5 8.505 8.505 0 00-1.094-.891 7.293 7.293 0 01-.578 1.937c.29.352.578.75.82 1.156zm-2.367 2.703c.445.195.906.36 1.382.484.688-.586 1.258-1.296 1.758-2.046-.485.015-.992-.04-1.46-.094-.196-.445-.384-.851-.641-1.258-.375.563-.797 1.102-1.32 1.54.132.452.226.913.28 1.382v-.008zM6.706 17.7c.055-.469.149-.93.282-1.383-.516-.437-.946-.976-1.32-1.539-.258.407-.446.813-.641 1.258-.469.063-.976.11-1.46.094.5.75 1.07 1.46 1.757 2.046a9.333 9.333 0 001.382-.484v.008zm-1.518-3.74c-.289.35-.578.75-.82 1.155-.481 0-.948-.047-1.445-.117-.375-.82-.656-1.687-.78-2.585.452.203.897.367 1.374.5.336-.329.71-.625 1.093-.891.086.672.297 1.32.579 1.937zM3.29 11.685c.407-.273.813-.523 1.211-.726-.016-.68.07-1.36.242-2.016a9.536 9.536 0 00-1.359.383A9.909 9.909 0 012.322 8.32a10.024 10.024 0 00-.32 2.68c.43.265.859.492 1.288.695v-.008zm1.797-3.75a8.7 8.7 0 00-1.398.18 9.459 9.459 0 01-.906-1.148A9.983 9.983 0 014.157 4.64c.164.477.344.922.563 1.352.476.03.953.109 1.398.203a7.531 7.531 0 00-1.031 1.742zM7.954 18.03L12 19.595l4.046-1.564.36.933-3.02 1.167 1.138.44-.36.932L12 20.667l-2.163.836-.36-.932 1.136-.44-3.02-1.167.361-.933zm7.43-11.064c.034-.052.119-.035.119.034v7.04c0 .035-.102.086-.153.069-.69-.27-1.55-.612-2.49-.984a612.44 612.44 0 00-6.292-2.467c-.068-.035-.034-.138.051-.138h6.51c.394-.648.833-1.333 1.46-2.311l.795-1.243z"
              fill="rgb(255, 0, 43)"></path>
    </svg>
</span>`;

const LEVEL_COLORS = {
    1: '#EEE',
    2: '#1CE400',
    3: '#1CE400',
    4: '#FFC800',
    5: '#FFC800',
    6: '#FFC800',
    7: '#FFC800',
    8: '#FF6309',
    9: '#FF6309',
    10: '#FE1F00',
    11: '#FE0123',
    12: '#FD0346',
    13: '#FE0379',
    14: '#FF019B',
    15: '#CC29C8',
    16: '#4693EC',
    17: '#1FB2F7',
    18: '#00CBFF',
    19: '#4CDBFF',
    20: '#fff'
};

const PROGRESS_PATHS = {
    1: 'M5.894 15.816 3.858 17.09a9.656 9.656 0 0 0 1.894 2.2l1.562-1.822a7.206 7.206 0 0 1-1.42-1.65v-.002Z',
    2: 'm5.257 14.53-2.249.842a9.613 9.613 0 0 0 2.743 3.917l1.563-1.822a7.203 7.203 0 0 1-2.057-2.937Z',
    3: 'M2.4 12a9.58 9.58 0 0 0 3.352 7.29l1.562-1.823A7.184 7.184 0 0 1 4.801 12H2.4Z',
    4: 'M6.91 6.91 5.211 5.211A9.57 9.57 0 0 0 2.4 12a9.58 9.58 0 0 0 3.352 7.289l1.562-1.822A7.184 7.184 0 0 1 4.801 12c0-1.988.806-3.788 2.109-5.09Z',
    5: 'M12 2.4A9.6 9.6 0 0 0 2.4 12a9.58 9.58 0 0 0 3.352 7.29l1.562-1.823A7.2 7.2 0 0 1 12 4.8V2.4Z',
    6: 'M15.816 5.895a7.2 7.2 0 0 0-8.502 11.572l-1.562 1.822A9.58 9.58 0 0 1 2.4 12a9.6 9.6 0 0 1 14.689-8.142l-1.273 2.037Z',
    7: 'M17.934 7.92a7.2 7.2 0 1 0-10.62 9.546L5.752 19.29A9.58 9.58 0 0 1 2.4 12a9.6 9.6 0 0 1 17.512-5.44l-1.978 1.36Z',
    8: 'M19.2 12h2.4a9.6 9.6 0 1 0-19.2 0 9.58 9.58 0 0 0 3.352 7.29l1.562-1.823A7.2 7.2 0 1 1 19.2 12Z',
    9: 'M18.517 15.066a7.2 7.2 0 1 0-11.202 2.4L5.751 19.29A9.58 9.58 0 0 1 2.4 12a9.6 9.6 0 0 1 19.2 0 9.563 9.563 0 0 1-.91 4.089l-2.173-1.023Z',
    full: 'M16.686 17.467a7.2 7.2 0 1 0-9.371 0l-1.563 1.822A9.58 9.58 0 0 1 2.4 12a9.6 9.6 0 1 1 19.2 0 9.58 9.58 0 0 1-3.352 7.29l-1.562-1.823Z'
};

const DIGIT_PATHS = {
    '1': 'm11.765 10.233-1.487.824v-1.034L12 8.948h.991V14.4h-1.226v-4.167Z',
    '1_left': 'M9.487 10.369 8 11.193v-1.034l1.722-1.075h.991v5.452H9.487v-4.167Z',
    '1_11_left': 'm9.787 10.285-1.487.824v-1.034L10.022 9h.991v5.452H9.787v-4.167Z',
    '1_11_right': 'm13.791 10.285-1.486.824v-1.034L14.027 9h.99v5.452h-1.226v-4.167Z',
    '1_16': 'm9.233 10.233-1.487.824v-1.034l1.722-1.075h.991V14.4H9.233v-4.167Z',
    '2': 'M10.05 13.157c0-.303.084-.566.252-.79a1.6 1.6 0 0 1 .655-.512 8.18 8.18 0 0 1 .748-.286c.233-.071.456-.173.663-.302.157-.107.235-.233.235-.378v-.698c0-.173-.07-.288-.21-.344-.15-.062-.386-.092-.705-.092-.387 0-.896.07-1.529.21V9.04a8.522 8.522 0 0 1 1.756-.177c.66 0 1.15.101 1.47.303.324.201.487.537.487 1.008v.756c0 .285-.087.534-.26.747-.174.211-.4.373-.656.47-.252.107-.51.202-.773.286a2.65 2.65 0 0 0-.68.336c-.162.123-.244.27-.244.437v.277h2.621v.916h-3.83v-1.242Z',
    '2_12': 'M12 13.294c0-.303.084-.566.252-.79a1.6 1.6 0 0 1 .655-.512 8.18 8.18 0 0 1 .748-.286c.233-.071.456-.173.663-.302.157-.107.235-.233.235-.378v-.698c0-.173-.07-.288-.21-.344-.15-.062-.386-.092-.705-.092-.387 0-.896.07-1.529.21v-.925A8.522 8.522 0 0 1 13.865 9c.66 0 1.15.101 1.47.303.324.201.487.537.487 1.008v.756c0 .285-.087.534-.26.747-.174.211-.4.373-.656.47-.252.107-.51.202-.773.286a2.66 2.66 0 0 0-.68.336c-.162.123-.244.27-.244.437v.277h2.621v.916H12v-1.242Z',
    '2_20': 'M7.5 13.294c0-.303.084-.566.252-.79a1.6 1.6 0 0 1 .655-.512c.245-.108.494-.203.748-.286.233-.071.456-.173.663-.302.157-.107.235-.233.235-.378v-.698c0-.173-.07-.288-.21-.344-.15-.062-.386-.092-.705-.092-.387 0-.896.07-1.529.21v-.925A8.523 8.523 0 0 1 9.365 9c.66 0 1.15.101 1.47.303.324.201.487.537.487 1.008v.756c0 .285-.087.534-.26.747-.174.211-.4.373-.656.47-.252.107-.51.202-.773.286a2.66 2.66 0 0 0-.68.336c-.162.123-.244.27-.244.437v.277h2.621v.916H7.5v-1.242Z',
    '3': 'M11.79 14.484c-.47 0-1.08-.042-1.831-.126v-.975l.269.05c.106.023.165.037.176.043l.286.05c.067.011.21.028.428.05.168.017.339.026.513.026.324 0 .548-.04.672-.118.128-.078.193-.227.193-.445v-.63c0-.263-.283-.395-.849-.395h-.99v-.84h.99c.437 0 .656-.16.656-.479v-.529a.453.453 0 0 0-.068-.269c-.044-.067-.126-.114-.243-.142a2.24 2.24 0 0 0-.504-.042c-.32 0-.812.033-1.479.1V8.94c.762-.05 1.3-.076 1.613-.076.683 0 1.176.079 1.479.235.308.157.462.434.462.832v.899a.62.62 0 0 1-.152.42.703.703 0 0 1-.37.227c.494.173.74.445.74.814v.89c0 .466-.16.799-.479 1-.319.202-.823.303-1.512.303Z',
    '3_13': 'M13.831 14.62c-.47 0-1.08-.042-1.831-.126v-.975l.269.05c.106.023.165.037.176.043l.286.05c.067.011.21.028.428.05.168.017.339.026.513.026.324 0 .548-.04.672-.118.128-.078.193-.227.193-.445v-.63c0-.263-.283-.395-.849-.395h-.99v-.84h.99c.437 0 .656-.16.656-.479v-.529a.453.453 0 0 0-.068-.269c-.044-.067-.126-.114-.243-.142a2.24 2.24 0 0 0-.504-.042c-.32 0-.812.033-1.479.1v-.873c.762-.05 1.3-.076 1.613-.076.683 0 1.176.079 1.479.235.308.157.462.434.462.832v.899a.62.62 0 0 1-.152.42.703.703 0 0 1-.37.227c.494.173.74.445.74.814v.89c0 .466-.16.799-.479 1-.319.202-.823.303-1.512.303Z',
    '4': 'M12.303 13.3h-2.52v-.967l2.243-3.385h1.386v3.47H14v.881h-.588v1.1h-1.109v-1.1.001Zm0-.883v-2.31l-1.47 2.31h1.47Z',
    '4_14': 'M14.52 13.352H12v-.967L14.243 9h1.386v3.47h.588v.881h-.588v1.1H14.52v-1.1.001Zm0-.883v-2.31l-1.47 2.31h1.47Z',
    '5': 'M11.815 14.484c-.386 0-.966-.031-1.739-.093v-1.016c.695.129 1.218.193 1.571.193.308 0 .532-.033.672-.1a.357.357 0 0 0 .21-.337v-.814c0-.152-.05-.258-.151-.32-.101-.067-.266-.1-.496-.1h-1.68V8.948h3.444v.941H11.43v1.109h.856c.325 0 .642.061.95.185a.91.91 0 0 1 .554.865v1.142c0 .219-.042.415-.126.588-.084.168-.19.297-.32.387-.137.095-.29.163-.453.201-.185.05-.364.084-.537.101-.18.01-.359.016-.538.017h-.001Z',
    '5_15': 'M13.739 14.536c-.386 0-.966-.031-1.739-.093v-1.016c.695.129 1.218.193 1.571.193.308 0 .532-.033.672-.1a.357.357 0 0 0 .21-.337v-.814c0-.152-.05-.258-.151-.32-.101-.067-.266-.1-.496-.1h-1.68V9h3.444v.941h-2.216v1.109h.856c.325 0 .642.061.95.185a.91.91 0 0 1 .554.865v1.142c0 .219-.042.415-.126.588-.084.168-.19.297-.32.387-.137.095-.29.163-.453.201-.185.05-.364.084-.537.101-.18.01-.359.016-.538.017h-.001Z',
    '6': 'M11.992 14.484a6.003 6.003 0 0 1-.613-.025 2.483 2.483 0 0 1-.496-.11 1.24 1.24 0 0 1-.453-.243 1.184 1.184 0 0 1-.286-.437 1.892 1.892 0 0 1-.118-.689v-2.537c0-.268.045-.506.135-.714.095-.212.215-.375.361-.487.123-.095.288-.173.496-.235a2.71 2.71 0 0 1 .604-.126c.213-.011.406-.017.58-.017.24 0 .745.028 1.512.084v.9c-.756-.09-1.296-.135-1.621-.135-.269 0-.46.014-.571.042-.112.028-.188.084-.227.168-.034.078-.05.22-.05.428v.647h.898c.303 0 .521.005.655.017.135.005.286.03.454.075.18.045.31.11.395.193.09.079.168.2.235.362.062.168.092.366.092.596v.74c0 .257-.039.484-.117.68-.079.19-.18.338-.303.445-.112.1-.26.182-.445.243-.173.06-.354.098-.537.11a5.589 5.589 0 0 1-.58.025Zm.017-.815c.246 0 .417-.014.512-.042.101-.028.165-.081.193-.16.034-.14.048-.284.042-.428v-.79c0-.134-.016-.23-.05-.285-.034-.062-.104-.104-.21-.126a2.558 2.558 0 0 0-.496-.034h-.756v1.243c0 .19.014.328.042.412.034.084.101.14.202.168.106.028.281.042.521.042Z',
    '6_16': 'M13.966 14.62a6 6 0 0 1-.613-.025 2.483 2.483 0 0 1-.496-.11 1.239 1.239 0 0 1-.453-.243 1.184 1.184 0 0 1-.286-.437 1.887 1.887 0 0 1-.118-.689v-2.537c0-.268.045-.506.135-.714.095-.212.215-.375.361-.487.123-.095.288-.173.496-.235.196-.065.399-.107.604-.126.213-.011.406-.017.58-.017.24 0 .745.028 1.512.084v.9c-.756-.09-1.296-.135-1.62-.135-.27 0-.46.014-.572.042-.112.028-.188.084-.227.168-.034.078-.05.22-.05.428v.647h.898c.303 0 .521.005.655.017.135.005.286.03.454.075.18.045.31.11.395.193.09.079.168.2.235.362.062.168.092.366.092.596v.74c0 .257-.039.484-.117.68-.079.19-.18.338-.303.445-.112.1-.26.182-.445.243-.173.06-.354.098-.537.11a5.589 5.589 0 0 1-.58.025Zm.017-.815c.246 0 .417-.014.512-.042.101-.028.165-.081.193-.16a1.47 1.47 0 0 0 .042-.428v-.79c0-.134-.016-.23-.05-.285-.034-.062-.104-.104-.21-.126a2.56 2.56 0 0 0-.496-.034h-.756v1.243c0 .19.014.328.042.412.034.084.101.14.202.168.106.028.281.042.521.042Z',
    '7': 'M12.546 9.906H9.9v-.958h4v.84L11.807 14.4h-1.36l2.1-4.494h-.001Z',
    '7_17': 'M12 9.958V9h4v.84l-2.093 4.612h-1.36l2.1-4.494H12Z',
    '8': 'M12 14.484c-.723 0-1.252-.09-1.588-.269-.33-.18-.496-.49-.496-.932v-.941c0-.18.09-.347.269-.504.179-.157.392-.263.638-.32v-.033a.88.88 0 0 1-.504-.235.612.612 0 0 1-.218-.462v-.781c0-.392.143-.68.428-.866.291-.184.781-.277 1.47-.277s1.176.093 1.462.277c.291.185.437.474.437.866v.78a.613.613 0 0 1-.219.463.879.879 0 0 1-.504.235v.034c.247.056.46.162.639.319s.268.325.268.504v.94c0 .454-.17.768-.512.941-.342.174-.865.26-1.57.26v.001Zm0-3.293c.246 0 .416-.034.512-.1.1-.074.15-.188.15-.345v-.63c0-.163-.05-.277-.15-.345-.096-.072-.266-.109-.513-.109-.246 0-.42.037-.52.11-.096.067-.143.181-.143.344v.63a.41.41 0 0 0 .142.336c.09.073.264.11.521.11l.001-.001Zm0 2.495c.24 0 .414-.014.52-.042.112-.028.185-.076.218-.143.04-.067.06-.174.06-.32v-.738c0-.163-.048-.283-.144-.362-.095-.072-.31-.109-.646-.109-.32 0-.535.037-.647.11-.107.067-.16.187-.16.36v.74c0 .145.017.252.05.32.04.066.113.114.219.142.112.028.288.042.53.042Z',
    '8_18': 'M14.084 14.62c-.723 0-1.252-.09-1.588-.269-.33-.18-.496-.49-.496-.932v-.941c0-.18.09-.347.269-.504.179-.157.392-.263.638-.32v-.033a.879.879 0 0 1-.504-.235.612.612 0 0 1-.218-.462v-.781c0-.392.143-.68.428-.866.291-.184.781-.277 1.47-.277s1.176.093 1.462.277c.291.185.437.474.437.866v.78a.613.613 0 0 1-.219.463.879.879 0 0 1-.504.235v.034c.247.056.46.162.639.319s.268.325.268.504v.94c0 .454-.17.768-.512.941-.342.174-.865.26-1.57.26v.001Zm0-3.293c.246 0 .416-.034.512-.1.1-.074.15-.188.15-.345v-.63c0-.163-.05-.277-.15-.345-.096-.072-.266-.109-.513-.109-.246 0-.42.037-.52.11-.096.067-.143.181-.143.344v.63a.409.409 0 0 0 .142.336c.09.073.264.11.521.11l.001-.001Zm0 2.495c.24 0 .414-.014.52-.042.112-.028.185-.076.218-.143.04-.067.06-.174.06-.32v-.738c0-.163-.048-.283-.144-.362-.095-.072-.31-.109-.646-.109-.32 0-.535.037-.647.11-.107.067-.16.187-.16.36v.74c0 .145.017.252.05.32.04.066.113.114.219.142.112.028.288.042.53.042Z',
    '9': 'M11.84 14.484c-.48 0-.999-.028-1.553-.084v-.874c.717.079 1.229.118 1.537.118.286 0 .493-.02.622-.059.128-.04.212-.112.252-.218.044-.107.067-.275.067-.504v-.513h-.907c-.303 0-.521-.003-.656-.008a2.629 2.629 0 0 1-.453-.084.897.897 0 0 1-.395-.193 1.051 1.051 0 0 1-.235-.37 1.707 1.707 0 0 1-.093-.588v-.74c0-.257.04-.48.118-.671.078-.196.18-.35.302-.462.112-.095.258-.174.437-.235.185-.062.367-.101.546-.118.213-.011.406-.017.58-.017.263 0 .47.009.621.025.157.012.322.045.496.101a1.129 1.129 0 0 1 .74.689c.081.22.12.454.117.689v2.537c0 .565-.171.971-.513 1.218-.336.24-.879.36-1.63.36v.001Zm.925-2.949V10.26c0-.19-.017-.322-.05-.395-.029-.073-.093-.12-.194-.143a2.73 2.73 0 0 0-.529-.034 2.11 2.11 0 0 0-.504.042.26.26 0 0 0-.193.152c-.034.072-.05.198-.05.378v.831c0 .135.016.233.05.294.033.056.1.095.201.118a2.7 2.7 0 0 0 .504.033h.765v-.001Z',
    '9_19': 'M13.814 14.62c-.48 0-.999-.028-1.553-.084v-.874c.717.079 1.23.118 1.537.118.286 0 .493-.02.622-.059.128-.04.212-.112.252-.218.044-.107.067-.275.067-.504v-.513h-.907c-.303 0-.52-.003-.656-.008a2.629 2.629 0 0 1-.453-.084.897.897 0 0 1-.395-.193 1.051 1.051 0 0 1-.235-.37 1.707 1.707 0 0 1-.093-.588v-.74c0-.257.04-.48.118-.671.078-.196.18-.35.302-.462.112-.095.258-.174.437-.235.185-.062.367-.101.546-.118.213-.011.406-.017.58-.017.263 0 .47.009.621.025.157.012.322.045.496.101a1.129 1.129 0 0 1 .74.689c.082.22.121.454.117.689v2.537c0 .565-.17.971-.513 1.218-.336.24-.879.36-1.63.36v.001Zm.925-4.224c0-.19-.017-.322-.05-.395-.029-.073-.093-.12-.194-.143a2.73 2.73 0 0 0-.529-.034 2.11 2.11 0 0 0-.504.042.26.26 0 0 0-.193.152c-.034.072-.05.198-.05.378v.831c0 .135.016.233.05.294.033.056.1.095.201.118a2.7 2.7 0 0 0 .504.033h.765v-1.276Z',
    '0': 'M13.828 14.484c-.246 0-.448-.009-.604-.025a3.293 3.293 0 0 1-.513-.101 1.236 1.236 0 0 1-.462-.235 1.202 1.202 0 0 1-.294-.454 1.7 1.7 0 0 1-.126-.689v-2.612c0-.258.04-.485.118-.68a1.23 1.23 0 0 1 .302-.463c.107-.095.252-.17.437-.226.18-.06.365-.1.554-.118.213-.011.41-.017.588-.017.252 0 .454.009.605.025.171.016.34.05.504.101.202.062.361.143.479.244.118.1.218.246.302.437.084.19.126.422.126.697v2.612c0 .258-.042.485-.126.68a1.15 1.15 0 0 1-.302.454 1.32 1.32 0 0 1-.462.235c-.19.062-.372.098-.546.11a5.589 5.589 0 0 1-.58.025Zm.017-.79c.235 0 .403-.014.504-.042a.306.306 0 0 0 .202-.176c.033-.084.05-.221.05-.412v-2.78c0-.19-.017-.328-.05-.412a.282.282 0 0 0-.202-.168c-.1-.033-.269-.05-.504-.05-.24 0-.414.017-.52.05a.282.282 0 0 0-.202.168c-.034.084-.05.221-.05.412v2.78c0 .19.016.328.05.412.033.084.1.143.2.176.108.028.28.042.522.042Z',
    '0_20': 'M14.5 14.62c-.246 0-.448-.009-.604-.025a3.293 3.293 0 0 1-.513-.101 1.236 1.236 0 0 1-.462-.235 1.202 1.202 0 0 1-.294-.454 1.7 1.7 0 0 1-.126-.689v-2.612c0-.258.04-.485.118-.68a1.23 1.23 0 0 1 .302-.463c.107-.095.252-.17.437-.226.18-.06.365-.1.554-.118.213-.011.41-.017.588-.017.252 0 .454.009.605.025.17.016.34.05.504.101.202.062.36.143.479.244.118.1.218.246.302.437.084.19.126.422.126.697v2.612c0 .258-.042.485-.126.68a1.15 1.15 0 0 1-.302.454 1.32 1.32 0 0 1-.462.235c-.19.062-.372.098-.546.11a5.589 5.589 0 0 1-.58.025Zm.017-.79c.235 0 .403-.014.504-.042a.306.306 0 0 0 .202-.176c.033-.084.05-.221.05-.412v-2.78c0-.19-.017-.328-.05-.412a.282.282 0 0 0-.202-.168c-.1-.033-.27-.05-.504-.05-.24 0-.414.017-.52.05a.282.282 0 0 0-.202.168c-.034.084-.05.221-.05.412v2.78c0 .19.016.328.05.412.033.084.1.143.2.176.108.028.28.042.522.042Z'
};

const LEVEL_DIGITS = {
    1: ['1'],
    2: ['2'],
    3: ['3'],
    4: ['4'],
    5: ['5'],
    6: ['6'],
    7: ['7'],
    8: ['8'],
    9: ['9'],
    10: ['1_16', '0'],
    11: ['1_11_left', '1_11_right'],
    12: ['1_left', '2_12'],
    13: ['1_left', '3_13'],
    14: ['1_left', '4_14'],
    15: ['1_left', '5_15'],
    16: ['1_16', '6_16'],
    17: ['1_16', '7_17'],
    18: ['1_left', '8_18'],
    19: ['1_left', '9_19'],
    20: ['2_20', '0_20']
};

const SVG_START = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><g clip-path="url(#a)">';
const SVG_END = '</g><defs><clipPath id="a"><path fill="#fff" d="M0 0h24v24H0z"/></clipPath></defs></svg>';
const CIRCLE_BG = '<path fill="#111111" d="M12 24c6.627 0 12-5.373 12-12S18.627 0 12 0 0 5.373 0 12s5.373 12 12 12Z"/>';
const PROGRESS_BG = '<path fill="#CDCDCD" fill-opacity=".1" fill-rule="evenodd" d="M16.686 17.467a7.2 7.2 0 1 0-9.371 0l-1.563 1.822A9.58 9.58 0 0 1 2.4 12a9.6 9.6 0 1 1 19.2 0 9.58 9.58 0 0 1-3.352 7.29l-1.562-1.823Z" clip-rule="evenodd"/>';

function generateLevelIcon(level) {
    const color = LEVEL_COLORS[level];
    const progressPath = level >= 10 ? PROGRESS_PATHS.full : PROGRESS_PATHS[level];
    const digitKeys = LEVEL_DIGITS[level];

    const progressBg = level >= 11 ? '' : PROGRESS_BG;

    const progressSvg = `<path fill="${color}" fill-rule="evenodd" d="${progressPath}" clip-rule="evenodd"/>`;

    const digitsSvg = digitKeys.map(key => `<path fill="${color}" d="${DIGIT_PATHS[key]}"/>`).join('');

    return htmlToElement(`<span title="Skill Level ${level}" style="display: inline-block;">${SVG_START}${CIRCLE_BG}${progressBg}${progressSvg}${digitsSvg}${SVG_END}</span>`);
}

const ELO_PROGRESS_BAR_HTML = /*language=HTML*/ `<a class="user-url">
    <div class="player-stats">
        <div class="skill-current-level"></div>
        <div class="details">
            <div class="flex-between">
                <div class="elo progress-current-elo">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" color="secondary"
                         viewBox="0 0 24 12">
                        <title>Elo Icon</title>
                        <path fill="rgba(255,255,255,0.6)"
                              d="M12 3c0 .463-.105.902-.292 1.293l1.998 2A2.97 2.97 0 0 1 15 6a2.99 2.99 0 0 1 1.454.375l1.921-1.921a3 3 0 1 1 1.5 1.328l-2.093 2.093a3 3 0 1 1-5.49-.168l-1.999-2a2.992 2.992 0 0 1-2.418.074L5.782 7.876a3 3 0 1 1-1.328-1.5l1.921-1.921A3 3 0 1 1 12 3z"></path>
                    </svg>
                    <div class="elo-value"></div>
                </div>
                <div class="brand-icon" data-tooltip="FORECAST"></div>
            </div>
            <div>
                <div class="progress-container elo-progress-bar-container">
                    <div class="progress elo-progress-bar"></div>
                </div>
                <div class="progress-info">
                    <span class="min-elo-level"></span>
                    <span class="elo-to-de-or-up-grade"></span>
                    <span class="max-elo-level"></span>
                </div>
            </div>
        </div>
    </div>
</a>`;

const ELO_PROGRESS_BAR_MASTER_HTML = /*language=HTML*/ `
    <div class="master-progress-container">
        <div class="master-text-container">
            <div class="master-level-info-left">
                <div class="master-min-icon"></div>
            </div>
            <div class="master-level-info-right">
                <div class="master-max-icon"></div>
            </div>
        </div>
        <div class="master-progress-bar-wrapper">
            <div class="master-progress-bar-holder">
                <div class="master-progress-bar-content">
                    <div class="master-progress-bar-inner">
                        <div class="master-progress-bar"></div>
                    </div>
                </div>
            </div>
        </div>
        <div class="master-text-container">
            <div class="master-level-info-left">
                <span class="master-level-text master-min-value"></span>
            </div>

            <div class="master-level-info-right">
                <span class="master-level-text master-max-value"></span>
            </div>
        </div>
    </div>`;

const ELO_PROGRESS_BAR_SEPARATED_HTML = /*language=HTML*/`
    <div class="elo-separated-container elo-separated-col">
        <div id="fc-elo-icons-container" class="elo-separated-flex elo-separated-row">
        </div>
        <div class="elo-separated-holder">
            <div class="elo-separated-progress-holder">
                <div class="elo-separated-progress"></div>
            </div>
        </div>
        <div class="elo-separated-flex elo-separated-row">
            <span id="fc-elo-min" class="elo-separated-text-muted"></span>
            <span id="fc-elo-cur" class="elo-separated-text-bold"></span>
            <span id="fc-elo-max" class="elo-separated-text-muted"></span>
        </div>
    </div>
`

const LEVEL_PROGRESS_TABLE_HTML = /*language=HTML*/ `
    <div>
        <div class="level-progress-container">
            <div class="flex-between">
                <div class="title" data-i18n="level_progress">Level Progress</div>
                <div class="brand-icon" data-tooltip="FORECAST"></div>
            </div>
            <div class="stats">
                <div class="stat-block">
                    <div class="stat-title current-level glow"><span title="Skill Level 9"></span></div>
                    <div class="stat-label" data-i18n="level">Level</div>
                </div>
                <div class="stat-block">
                    <div class="stat-title current-elo glow" style="--glow-color: rgba(0, 170, 255, 0.7);">0</div>
                    <div class="stat-label">Elo</div>
                </div>
                <div class="stat-block">
                    <div class="stat-title elo-need-to-reach glow" style="--glow-color: rgba(255, 255, 255, 0.5);">0
                    </div>
                    <div class="stat-label elo-need-to-reach-text" data-i18n="points_needed">Points needed to reach
                        level 10
                    </div>
                </div>
            </div>

            <div class="levels-container">
                <div class="level level-node-1">
                    <span title="Skill Level 1"></span>
                    <div class="level-value"></div>
                    <div class="progress-bar-container">
                        <div class="progress-bar progress-bar-1" style="width: 0;"></div>
                    </div>
                </div>
                <div class="level level-node-2">
                    <span title="Skill Level 2"></span>
                    <div class="level-value"></div>
                    <div class="progress-bar-container">
                        <div class="progress-bar progress-bar-2" style="width: 0;"></div>
                    </div>
                </div>
                <div class="level level-node-3">
                    <span title="Skill Level 3"></span>
                    <div class="level-value"></div>
                    <div class="progress-bar-container">
                        <div class="progress-bar progress-bar-3" style="width: 0;"></div>
                    </div>
                </div>
                <div class="level level-node-4">
                    <span title="Skill Level 4"></span>
                    <div class="level-value"></div>
                    <div class="progress-bar-container">
                        <div class="progress-bar progress-bar-4" style="width: 0;"></div>
                    </div>
                </div>
                <div class="level level-node-5">
                    <span title="Skill Level 5"></span>
                    <div class="level-value"></div>
                    <div class="progress-bar-container">
                        <div class="progress-bar progress-bar-5" style="width: 0;"></div>
                    </div>
                </div>
                <div class="level level-node-6">
                    <span title="Skill Level 6"></span>
                    <div class="level-value"></div>
                    <div class="progress-bar-container">
                        <div class="progress-bar progress-bar-6" style="width: 0;"></div>
                    </div>
                </div>
                <div class="level level-node-7">
                    <span title="Skill Level 7"></span>
                    <div class="level-value"></div>
                    <div class="progress-bar-container">
                        <div class="progress-bar progress-bar-7" style="width: 0;"></div>
                    </div>
                </div>
                <div class="level level-node-8">
                    <span title="Skill Level 8"></span>
                    <div class="level-value"></div>
                    <div class="progress-bar-container">
                        <div class="progress-bar progress-bar-8" style="width: 0;"></div>
                    </div>
                </div>
                <div class="level level-node-9">
                    <span title="Skill Level 9"></span>
                    <div class="level-value"></div>
                    <div class="progress-bar-container">
                        <div class="progress-bar progress-bar-9" style="width: 0;"></div>
                    </div>
                </div>
                <div class="level level-node-10">
                    <span title="Skill Level 10"></span>
                    <div class="level-value"></div>
                    <div class="progress-bar-container">
                        <div class="progress-bar progress-bar-10" style="width: 0;"></div>
                    </div>
                </div>
                <div class="level level-node-11">
                    <span title="Skill Level 11"></span>
                    <div class="level-value"></div>
                    <div class="progress-bar-container">
                        <div class="progress-bar progress-bar-11" style="width: 0;"></div>
                    </div>
                </div>
                <div class="level level-node-12">
                    <span title="Skill Level 12"></span>
                    <div class="level-value"></div>
                    <div class="progress-bar-container">
                        <div class="progress-bar progress-bar-12" style="width: 0;"></div>
                    </div>
                </div>
                <div class="level level-node-13">
                    <span title="Skill Level 13"></span>
                    <div class="level-value"></div>
                    <div class="progress-bar-container">
                        <div class="progress-bar progress-bar-13" style="width: 0;"></div>
                    </div>
                </div>
                <div class="level level-node-14">
                    <span title="Skill Level 14"></span>
                    <div class="level-value"></div>
                    <div class="progress-bar-container">
                        <div class="progress-bar progress-bar-14" style="width: 0;"></div>
                    </div>
                </div>
                <div class="level level-node-15">
                    <span title="Skill Level 15"></span>
                    <div class="level-value"></div>
                    <div class="progress-bar-container">
                        <div class="progress-bar progress-bar-15" style="width: 0;"></div>
                    </div>
                </div>
                <div class="level level-node-16">
                    <span title="Skill Level 16"></span>
                    <div class="level-value"></div>
                    <div class="progress-bar-container">
                        <div class="progress-bar progress-bar-16" style="width: 0;"></div>
                    </div>
                </div>
                <div class="level level-node-17">
                    <span title="Skill Level 17"></span>
                    <div class="level-value"></div>
                    <div class="progress-bar-container">
                        <div class="progress-bar progress-bar-17" style="width: 0;"></div>
                    </div>
                </div>
                <div class="level level-node-18">
                    <span title="Skill Level 18"></span>
                    <div class="level-value"></div>
                    <div class="progress-bar-container">
                        <div class="progress-bar progress-bar-18" style="width: 0;"></div>
                    </div>
                </div>
                <div class="level level-node-19">
                    <span title="Skill Level 19"></span>
                    <div class="level-value"></div>
                    <div class="progress-bar-container">
                        <div class="progress-bar progress-bar-19" style="width: 0;"></div>
                    </div>
                </div>
                <div class="level-large level-node-20">
                    <span title="Skill Level 20"></span>
                    <div class="level-value"></div>
                    <div class="progress-bar-container">
                        <div class="progress-bar progress-bar-20" style="width: 0;"></div>
                    </div>
                </div>
            </div>
        </div>
    </div>`;

const MATCH_COUNTER_ARROW_HTML = /*language=HTML*/ `
    <div>
        <div class="match-counter-arrow">
            <div class="match-counter-arrow-square"></div>
            <div class="match-counter-arrow-triangle"></div>
        </div>
    </div>`;

const MATCH_HISTORY_POPUP_HTML = /*language=HTML*/ `
    <div class="show-popup-button-wrap" style="width: 20px; height: 20px;">
        <button style="background: none; border: none; padding: 0; cursor: pointer; width: 20px; height: 20px;"
                class="show-popup-button">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 20 20">
                <path fill="#404040"
                      d="M16 0a4 4 0 0 1 4 4v12a4 4 0 0 1-4 4H4a4 4 0 0 1-4-4V4a4 4 0 0 1 4-4h12Zm-6 5.5C6.135 5.5 3 10 3 10s3.134 4.5 7 4.5 7-4.5 7-4.5-3.134-4.5-7-4.5Zm0 1.8a2.59 2.59 0 0 1 1.856.79 2.74 2.74 0 0 1 .769 1.91 2.74 2.74 0 0 1-.769 1.91A2.59 2.59 0 0 1 10 12.7a2.59 2.59 0 0 1-1.856-.79A2.74 2.74 0 0 1 7.375 10c0-.716.276-1.403.769-1.91A2.59 2.59 0 0 1 10 7.3Zm0 1.35c-.348 0-.682.142-.928.395a1.371 1.371 0 0 0-.384.955c0 .358.138.702.384.955s.58.395.928.395c.348 0 .682-.142.928-.395s.384-.597.384-.955-.138-.702-.384-.955A1.294 1.294 0 0 0 10 8.65Z"/>
            </svg>
        </button>
        <div class="popup-wrapper">
            <div class="popup-tooltip">
                <div class="popup-scoreboard-wrapper">
                    <table class="popup-scoreboard-table">
                        <thead class="popup-table-header">
                        <tr class="popup-table-row">
                            <td class="popup-table-cell">NICK</td>
                            <td class="popup-table-cell">K</td>
                            <td class="popup-table-cell">A</td>
                            <td class="popup-table-cell">D</td>
                            <td class="popup-table-cell">K/R</td>
                            <td class="popup-table-cell">K/D</td>
                            <td class="popup-table-cell">HS</td>
                            <td class="popup-table-cell">ADR</td>
                            <td class="popup-table-cell">FCR</td>
                            <td class="popup-table-cell">ELO</td>
                        </tr>
                        </thead>
                        <tbody class="popup-table-body" id="team-table-body-popup-1">
                        </tbody>
                    </table>
                </div>
                <div class="popup-scoreboard-wrapper">
                    <table class="popup-scoreboard-table">
                        <thead class="popup-table-header">
                        <tr class="popup-table-row">
                            <td class="popup-table-cell">NICK</td>
                            <td class="popup-table-cell">K</td>
                            <td class="popup-table-cell">A</td>
                            <td class="popup-table-cell">D</td>
                            <td class="popup-table-cell">K/R</td>
                            <td class="popup-table-cell">K/D</td>
                            <td class="popup-table-cell">HS</td>
                            <td class="popup-table-cell">ADR</td>
                            <td class="popup-table-cell">FCR</td>
                            <td class="popup-table-cell">ELO</td>
                        </tr>
                        </thead>
                        <tbody class="popup-table-body" id="team-table-body-popup-2">
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>`;

const PLAYER_WINRATE_TABLE_HTML = /*language=HTML*/ `
    <div class="player-background-table">
        <div class="player-container">
            <div class="brand-icon" data-tooltip="FORECAST"></div>
            <div class="player-name"></div>
            <table class="player-table">
                <thead>
                <tr>
                    <th>Map</th>
                    <th>Num</th>
                    <th>WR%</th>
                </tr>
                </thead>
                <tbody>
                </tbody>
            </table>
        </div>
    </div>`;

const TEAM_WINRATE_TABLE_HTML = /*language=HTML*/ `
    <div class="team-background-table">
        <div class="team-container">
            <div class="brand-icon" data-tooltip="FORECAST"></div>
            <div class="team-name roster1-name"></div>
            <table class="roster1">
                <thead>
                <tr>
                    <th>Map</th>
                    <th>Num</th>
                    <th>WR%</th>
                </tr>
                </thead>
                <tbody>
                </tbody>
            </table>
        </div>

        <div class="team-container">
            <div class="brand-icon" data-tooltip="FORECAST"></div>
            <div class="team-name roster2-name"></div>
            <table class="roster2">
                <thead>
                <tr>
                    <th>Map</th>
                    <th>Num</th>
                    <th>WR%</th>
                </tr>
                </thead>
                <tbody>
                </tbody>
            </table>
        </div>
    </div>`;

const SKILL_LEVELS_INFO_TABLE_HTML = /*language=HTML*/ `
    <div class="modalinfos-content">
        <div class="challengerinfos-header">
            <div class="challengerinfos-icon"></div>
            <div class="challengerinfos-info">
                <div class="challengerinfos-title" data-i18n="challenger">Challenger</div>
                <div class="challengerinfos-subtitle" data-i18n="top_players">Top 1,000 players</div>
            </div>
        </div>

        <div class="levelinfos-container">
            <div class="levelinfos-item lvl-10">
                <div class="levelinfos-icon"></div>
                <div class="levelinfos-info">
                    <div class="levelinfos-name"></div>
                    <div class="levelinfos-range"></div>
                </div>
            </div>
            <div class="levelinfos-item lvl-11">
                <div class="levelinfos-icon"></div>
                <div class="levelinfos-info">
                    <div class="levelinfos-name"></div>
                    <div class="levelinfos-range"></div>
                </div>
            </div>
            <div class="levelinfos-item lvl-9">
                <div class="levelinfos-icon"></div>
                <div class="levelinfos-info">
                    <div class="levelinfos-name"></div>
                    <div class="levelinfos-range"></div>
                </div>
            </div>
            <div class="levelinfos-item lvl-12">
                <div class="levelinfos-icon"></div>
                <div class="levelinfos-info">
                    <div class="levelinfos-name"></div>
                    <div class="levelinfos-range"></div>
                </div>
            </div>
            <div class="levelinfos-item lvl-8">
                <div class="levelinfos-icon"></div>
                <div class="levelinfos-info">
                    <div class="levelinfos-name"></div>
                    <div class="levelinfos-range"></div>
                </div>
            </div>
            <div class="levelinfos-item lvl-13">
                <div class="levelinfos-icon"></div>
                <div class="levelinfos-info">
                    <div class="levelinfos-name"></div>
                    <div class="levelinfos-range"></div>
                </div>
            </div>
            <div class="levelinfos-item lvl-7">
                <div class="levelinfos-icon"></div>
                <div class="levelinfos-info">
                    <div class="levelinfos-name"></div>
                    <div class="levelinfos-range"></div>
                </div>
            </div>
            <div class="levelinfos-item lvl-14">
                <div class="levelinfos-icon"></div>
                <div class="levelinfos-info">
                    <div class="levelinfos-name"></div>
                    <div class="levelinfos-range"></div>
                </div>
            </div>
            <div class="levelinfos-item lvl-6">
                <div class="levelinfos-icon"></div>
                <div class="levelinfos-info">
                    <div class="levelinfos-name"></div>
                    <div class="levelinfos-range"></div>
                </div>
            </div>
            <div class="levelinfos-item lvl-15">
                <div class="levelinfos-icon"></div>
                <div class="levelinfos-info">
                    <div class="levelinfos-name"></div>
                    <div class="levelinfos-range"></div>
                </div>
            </div>
            <div class="levelinfos-item lvl-5">
                <div class="levelinfos-icon"></div>
                <div class="levelinfos-info">
                    <div class="levelinfos-name"></div>
                    <div class="levelinfos-range"></div>
                </div>
            </div>
            <div class="levelinfos-item lvl-16">
                <div class="levelinfos-icon"></div>
                <div class="levelinfos-info">
                    <div class="levelinfos-name"></div>
                    <div class="levelinfos-range"></div>
                </div>
            </div>
            <div class="levelinfos-item lvl-4">
                <div class="levelinfos-icon"></div>
                <div class="levelinfos-info">
                    <div class="levelinfos-name"></div>
                    <div class="levelinfos-range"></div>
                </div>
            </div>
            <div class="levelinfos-item lvl-17">
                <div class="levelinfos-icon"></div>
                <div class="levelinfos-info">
                    <div class="levelinfos-name"></div>
                    <div class="levelinfos-range"></div>
                </div>
            </div>
            <div class="levelinfos-item lvl-3">
                <div class="levelinfos-icon"></div>
                <div class="levelinfos-info">
                    <div class="levelinfos-name"></div>
                    <div class="levelinfos-range"></div>
                </div>
            </div>
            <div class="levelinfos-item lvl-18">
                <div class="levelinfos-icon"></div>
                <div class="levelinfos-info">
                    <div class="levelinfos-name"></div>
                    <div class="levelinfos-range"></div>
                </div>
            </div>
            <div class="levelinfos-item lvl-2">
                <div class="levelinfos-icon"></div>
                <div class="levelinfos-info">
                    <div class="levelinfos-name"></div>
                    <div class="levelinfos-range"></div>
                </div>
            </div>
            <div class="levelinfos-item lvl-19">
                <div class="levelinfos-icon"></div>
                <div class="levelinfos-info">
                    <div class="levelinfos-name"></div>
                    <div class="levelinfos-range"></div>
                </div>
            </div>
            <div class="levelinfos-item lvl-1">
                <div class="levelinfos-icon"></div>
                <div class="levelinfos-info">
                    <div class="levelinfos-name"></div>
                    <div class="levelinfos-range"></div>
                </div>
            </div>
            <div class="levelinfos-item lvl-20">
                <div class="levelinfos-icon"></div>
                <div class="levelinfos-info">
                    <div class="levelinfos-name"></div>
                    <div class="levelinfos-range"></div>
                </div>
            </div>
        </div>
    </div>`;

const FORECAST_STYLES_HTML = `<style>
.profile-level-container::before {
    background: radial-gradient(circle at center top, rgba(255, 255, 255, 0.65) 0%, rgba(0, 0, 0, 0) 50%), linear-gradient(var(--glow-color) 0%, rgb(56, 56, 56) 60%) !important;
}
.profile-level-container::after {
    background: radial-gradient(24.53% 70.85% at 49.91% 29.02%, var(--glow-color-1) 0%, var(--glow-color-2) 43.61%, var(--glow-color-3) 100%), radial-gradient(24.53% 70.85% at 49.91% 29.02%, var(--glow-color-4) 0%, var(--glow-color-5) 43.61%, var(--glow-color-6) 100%), rgb(18, 18, 18) !important;
}

.user-url {
    text-decoration: none;
    display: block;
    padding: 10px;
    border-radius: 8px;
    background-color: rgb(3, 3, 3);
    transition: box-shadow 0.2s ease;
    position: relative;
    overflow: hidden;
    border: 1px solid rgb(36, 36, 36);
}

.player-stats {
    display: flex;
    font-size: 14px;
    color: #e0e0e0;
    align-items: center;
    gap: 10px;
}

.details {
    flex: 1;
    min-width: 0;
}

.flex-between {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
}

.elo {
    display: flex;
    align-items: center;
    gap: 6px;
    font-weight: 500;
}

.progress-current-elo svg {
    filter: drop-shadow(0 0 3px var(--glow-color));
    flex-shrink: 0;
}

.elo-value {
    color: #fff;
    font-size: 16px;
    font-weight: 600;
    text-shadow: 0 0 10px var(--glow-color);
}

.progress-container {
    margin: 4px 0 4px 0;
    height: 6px;
    width: 100%;
    background: rgba(50, 55, 55, 0.4);
    border-radius: 3px;
    overflow: hidden;
    position: relative;
}

.elo-progress-bar-container {
    height: 5px;
    background: rgba(50, 55, 55, 0.4);
}

.elo-progress-bar {
    box-shadow: 0 0 6px var(--glow-color);
    height: 100%;
    border-radius: 3px;
    background: linear-gradient(90deg, var(--gradient-start, #ff5500), var(--gradient-end, #ff8800)) no-repeat left center;
}

.progress-info {
    display: flex;
    justify-content: space-between;
    font-size: 12px;
    color: #aaa;
    padding: 2px 0;
    margin-top: 4px;
}

.progress {
    height: 100%;
    border-radius: 3px;
    position: relative;
}

@keyframes gradientMove {
    0% { background-position: 0 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0 50%; }
}

.min-elo-level,
.max-elo-level {
    opacity: 0.8;
    font-size: 11px;
}

.elo-to-de-or-up-grade {
    font-weight: 500;
    color: #fff;
    font-size: 12px;
}

.master-progress-container {
    display: flex;
    flex-direction: column;
    width: 100%;
    align-items: center;
}

.master-progress-bar-wrapper {
    width: 100%;
    margin: 5px 0 4px 0;
}

.master-progress-bar-holder {
    width: 100%;
    position: relative;
}

.master-progress-bar-content {
    display: flex;
    flex-direction: row;
    align-items: center;
}

.master-progress-bar-inner {
    width: 100%;
    height: 12px;
    border-radius: 2px;
    position: relative;
    box-sizing: border-box;
    background: rgba(255, 85, 0, 0.08);
    border: 1px solid rgba(255, 85, 0, 0.08);
}

.master-progress-bar {
    top: 0;
    inset-inline-start: 0;
    bottom: 0;
    width: 0;
    border-radius: 2px;
    position: absolute;
    content: "";
    background: linear-gradient(270deg, rgb(255, 85, 0) 0%, rgba(255, 85, 0, 0.08) 100%);
}

.master-level-info-left,
.master-level-info-right {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    width: 50%;
    color: rgba(255, 255, 255, 0.38);
}

.master-level-info-left {
    align-items: start;
}

.master-level-info-right {
    align-items: end;
}

.master-level-text {
    font-family: Play, sans-serif;
    letter-spacing: 0.02em;
    font-size: 14px;
    font-weight: bold;
    line-height: 20px;
}

.master-text-container {
    display: flex;
    justify-content: space-between;
    width: 100%;
}

.level-progress-container {
    box-sizing: border-box;
    padding: 24px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    border: 1px solid rgb(36, 36, 36);
    color: #e0e0e0;
    position: relative;
}

.brand-icon {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.brand-icon svg {
    width: 100%;
    height: 100%;
}

.brand-icon-small {
    width: 24px;
    height: 24px;
    border-radius: 6px;
    background-color: #1a1a1a;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35);
    border: 1px solid rgba(50, 50, 50, 0.6);
    flex-shrink: 0;
}

.title {
    font-weight: bold;
    margin-bottom: 20px;
    text-transform: uppercase;
    font-size: 18px;
    letter-spacing: 1px;
    color: #fff;
    display: inline-block;
}

.stats {
    display: flex;
    gap: 16px;
    margin-bottom: 24px;
}

.stat-block {
    flex: 1;
    padding: 16px 24px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    text-align: center;
    border-radius: 8px;
    border: 1px solid rgb(36, 36, 36);
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
}

.stat-title {
    font-size: 26px;
    font-weight: bold;
    color: #fff;
    margin-bottom: 6px;
}

.stat-label {
    text-transform: uppercase;
    font-size: 14px;
    color: #999;
    letter-spacing: 0.5px;
}

.levels-container {
    display: flex;
    width: 100%;
    position: relative;
    height: 100px;
}

.level {
    flex: 0 0 calc(92% / 19);
    text-align: center;
    padding-top: 10px;
    position: relative;
    transition: all 0.3s ease;
    height: 90px;
}

.level span, .level .level-value, .level .progress-bar-container {
    opacity: 0.5;
}

.level span, .level .level-value {
    transition: opacity 0.6s ease;
}

.level[reached] span, .level[reached] .level-value, .level[reached] .progress-bar-container {
    opacity: 1;
}

.level:hover:not([reached]) span, .level:hover:not([reached]) .level-value {
    opacity: 1;
    transition: opacity 0.3s ease;
}

.level .level-value, .level-large .level-value {
    cursor: default;
}

.level-large {
    flex: 1;
    text-align: center;
    padding-top: 10px;
    position: relative;
    border-radius: 0 5px 5px 0;
    height: 90px;
}

.level-large span, .level-large .level-value, .level-large .progress-bar-container {
    opacity: 0.5;
}

.level-large span, .level-large .level-value {
    transition: opacity 0.6s ease;
}

.level-large[reached] span, .level-large[reached] .level-value, .level-large[reached] .progress-bar-container {
    opacity: 1;
}

.level-large:hover:not([reached]) span, .level-large:hover:not([reached]) .level-value {
    opacity: 1;
    transition: opacity 0.3s ease;
}

.level-large .progress-bar-container {
    border-bottom-right-radius: 5px;
    border-top-right-radius: 5px;
}

.level:first-child {
    border-radius: 5px 0 0 5px;
}

.level:first-child .progress-bar-container {
    border-bottom-left-radius: 5px;
    border-top-left-radius: 5px;
}

.level span, .level-large span, .stat-block span {
    width: 32px;
    height: 32px;
    display: inline-block;
    position: relative;
}

.level span::before, .level-large span::before, .stat-block span::before {
    content: attr(styled-title);
    position: absolute;
    top: -28px;
    left: 50%;
    transform: translateX(-50%);
    border: 1px solid #242424;
    padding: 4px 8px;
    border-radius: 4px;
    opacity: 0;
    visibility: hidden;
    transition: opacity 0.3s, visibility 0.3s;
    white-space: nowrap;
    font-size: 12px;
}

.level:hover span::before, .level-large:hover span::before, .stat-block span:hover::before {
    opacity: 1;
    visibility: visible;
}

.level-value {
    margin-top: 6px;
    font-size: 14px;
    color: #aaa;
    transition: color 0.3s;
}

.level:hover .level-value, .level-large:hover .level-value {
    color: #fff;
}

.progress-bar-container {
    opacity: 1 !important;
    position: absolute;
    bottom: 0;
    left: 0;
    width: 100%;
    height: 6px;
    background: rgba(50, 55, 55, 0.4);
    overflow: hidden;
}

.progress-bar {
    height: 100%;
    background: linear-gradient(90deg, var(--gradient-start, #ff5500), var(--gradient-end, #ff8800));
    width: 0;
    box-shadow: 0 0 8px rgba(255, 85, 0, 0.5);
}

.current-level {
    color: #e0e0e0;
}

.current-elo {
    color: #fff;
    font-size: 32px;
}

.elo-need-to-reach {
    color: #fff;
    font-size: 32px;
}

.elo-need-to-reach-text {
    color: #999;
    font-size: 14px;
}

.glow {
    --glow-color: #1f1f22b3;
    text-shadow: 0 0 10px var(--glow-color);
}

.level[range]::after, .level-large::after {
    content: attr(range);
    position: absolute;
    bottom: -30px;
    left: 50%;
    transform: translateX(-50%);
    border: 1px solid #242424;
    color: #fff;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 11px;
    z-index: 10;
    white-space: nowrap;
    opacity: 0;
    visibility: hidden;
    transition: opacity 0.3s ease, visibility 0.3s ease;
}

.level[range]:hover::after, .level-large:hover::after {
    opacity: 1;
    visibility: visible;
}

tr[class*=MatchHistoryTableRow] {
    background-color: transparent !important;
}

.match-counter-arrow {
    position: relative;
    width: 100%;
    height: 0;
    display: flex;
    justify-content: flex-start;
    align-items: center;
}

.match-counter-arrow-triangle {
    width: 0;
    height: 0;
    border: 10px solid transparent;
    border-top-color: rgb(255, 255, 255);
    transform: rotate(45deg);
    translate: -50%;
}

.match-counter-arrow-square {
    background-color: rgb(255, 255, 255);
    display: inline-flex;
    justify-content: center;
    align-items: center;
    color: #2a2a2a;
    font-weight: bolder;
    font-size: 12px;
    white-space: nowrap;
    padding: 0 2px;
    translate: 0 -50%;
}

.show-popup-button svg {
    transition: opacity 0.15s ease;
    opacity: 0.7;
}

.show-popup-button:hover svg {
    opacity: 1;
}

.show-popup-button:hover + .popup-wrapper {
    display: block;
    pointer-events: auto;
}

.popup-wrapper:focus-within .popup-wrapper {
    display: block;
}

.popup-wrapper {
    position: relative !important;
    z-index: 3 !important;
    pointer-events: none;
    display: none;
    cursor: default;
}

.popup-tooltip {
    display: flex !important;
    flex-direction: column !important;
    gap: 12px !important;
    position: absolute;
    transform: translateY(-50%);
    translate: 25px -19px;
    margin: 6px;
}

.popup-scoreboard-wrapper {
    position: relative;
    flex: 1;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 4px 16px rgba(0, 0, 0, .7), 0 2px 8px #000;
    background: rgba(0, 0, 0, .65);
    border: 1px solid #242424;
    backdrop-filter: blur(7px);
    -webkit-backdrop-filter: blur(7px);
}

@-moz-document url-prefix() {
    .popup-scoreboard-wrapper {
        backdrop-filter: none !important;
        background: rgba(0, 0, 0, .9);
    }
}

.popup-scoreboard-table {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
    font-size: 14px;
    background: transparent;
}

.popup-table-header {
    background: rgba(0, 0, 0, 0.1) !important;
    color: #fff !important;
    text-align: center !important;
}

.popup-table-cell {
    padding: 8px !important;
    text-align: center !important;
    white-space: nowrap !important;
    border: none !important;
    background-color: transparent !important;
    color: #fff;
}

.popup-table-cell:first-child:before {
    content: none !important;
}

.popup-table-header .popup-table-cell:first-child {
    min-width: 110px;
}

.player-background-table {
    display: flex;
    justify-content: center;
    width: 100%;
    box-sizing: border-box;
}

.player-background-table .player-name {
    display: block;
    width: 100%;
    box-sizing: border-box;
    text-align: center;
    color: white;
    padding: 10px 15px;
    font-weight: bold;
    margin: 0;
    z-index: 2;
    position: relative;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: 16px;
    text-transform: uppercase;
}

.player-background-table .player-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    position: relative;
    border-radius: 12px;
    background: #030303;
    border: 1px solid rgb(36, 36, 36);
    max-width: 600px;
    width: 100%;
}

.player-background-table .player-table {
    width: 100%;
    background: transparent;
    border-radius: 12px;
    border-collapse: collapse;
    overflow: hidden;
    margin: 0;
    border: 1px solid rgb(36, 36, 36);
}

.player-background-table th,
.player-background-table td {
    border: none;
    text-align: center;
    color: white;
    padding: 1px 8px;
    background: transparent;
    box-shadow: none;
    height: 34px;
    box-sizing: border-box;
}

.player-background-table th {
    font-weight: 600;
    position: sticky;
    top: 0;
    font-size: 15px;
}

.player-background-table tr td {
    vertical-align: middle;
    transition: background-color 0.2s ease;
}

.player-background-table tbody tr:hover td {
    background-color: rgba(255, 255, 255, 0.05);
}

.player-background-table tbody tr:last-child td,
.player-background-table tr:last-child td {
    border-bottom: none;
}

.player-background-table td:nth-child(3) {
    font-weight: bold;
}

.player-background-table tbody tr:nth-child(even) td {
    background-color: rgba(255, 255, 255, 0.02);
}

@media (max-width: 768px) {
    .player-background-table {
        padding: 10px 0;
    }
}

.team-background-table {
    display: flex;
    justify-content: space-between;
    padding: 15px 0 10px;
    background: transparent;
    gap: 24px;
    max-width: 1200px;
    margin: 0 auto;
}

.team-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    position: relative;
    box-shadow: 0 6px 12px rgba(0, 0, 0, 0.15);
    border-radius: 12px;
}

.team-background-table .roster1, .team-background-table .roster2 {
    width: 100%;
    border-radius: 0 0 12px 12px;
    overflow: hidden;
    position: relative;
    border: 1px solid rgb(36, 36, 36);
    border-top-style: none;
}

.team-name {
    display: block;
    width: 100%;
    box-sizing: border-box;
    text-align: center;
    color: white;
    border-radius: 12px 12px 0 0;
    padding: 10px 15px;
    font-weight: bold;
    margin: 0;
    z-index: 2;
    position: relative;
    font-size: 14px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    border: 1px solid rgb(36, 36, 36);
    border-bottom-style: none;
}

.team-background-table th, .team-background-table td {
    border: none;
    text-align: center;
    color: white;
    padding: 1px 8px;
    background: transparent;
    box-shadow: none;
    height: 34px;
    box-sizing: border-box;
}

.team-background-table th {
    font-weight: 600;
    position: sticky;
    top: 0;
}

.team-background-table tr td {
    vertical-align: middle;
    transition: background-color 0.2s ease;
}

.team-background-table tbody tr:hover td {
    background-color: rgba(255, 255, 255, 0.05);
}

.team-background-table tbody tr:last-child td, .team-background-table tr:last-child td {
    border-bottom: none;
}

.team-background-table td:nth-child(3) {
    font-weight: bold;
}

.team-background-table tbody tr:nth-child(even) td {
    background-color: rgba(255, 255, 255, 0.02);
}

.modalinfos-content {
    max-width: 680px;
    width: 100%;
    background: #0e0e0e;
    border-radius: 12px;
    border: 1px solid #1a1a1a;
    overflow: hidden;
}

.challengerinfos-header {
    background: linear-gradient(135deg, #1a1a1a 0%, #252525 100%);
    padding: 18px 20px;
    text-align: center;
    border-bottom: 1px solid #2a2a2a;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
}

.challengerinfos-icon {
    width: 36px;
    height: 36px;
    flex-shrink: 0;
}

.challengerinfos-info {
    text-align: left;
}

.challengerinfos-title {
    color: white;
    font-size: 18px;
    font-weight: 600;
    margin-bottom: 2px;
}

.challengerinfos-subtitle {
    font-size: 12px;
    color: #888;
}

.levelinfos-container {
    padding: 12px;
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 6px;
}

.levelinfos-item {
    background: #121212;
    border-radius: 8px;
    padding: 10px 12px;
    display: flex;
    align-items: center;
    gap: 10px;
    border-left: 3px solid;
    position: relative;
}

.levelinfos-item.lvl-1 { border-left-color: #EEE; }
.levelinfos-item.lvl-2 { border-left-color: #1CE400; }
.levelinfos-item.lvl-3 { border-left-color: #1CE400; }
.levelinfos-item.lvl-4 { border-left-color: #FFC800; }
.levelinfos-item.lvl-5 { border-left-color: #FFC800; }
.levelinfos-item.lvl-6 { border-left-color: #FFC800; }
.levelinfos-item.lvl-7 { border-left-color: #FFC800; }
.levelinfos-item.lvl-8 { border-left-color: #FF6309; }
.levelinfos-item.lvl-9 { border-left-color: #FF6309; }
.levelinfos-item.lvl-10 { border-left-color: #FE1F00; }

.levelinfos-item.lvl-11 { border-left-color: #FE0123; }
.levelinfos-item.lvl-12 { border-left-color: #FD0346; }
.levelinfos-item.lvl-13 { border-left-color: #FE0379; }
.levelinfos-item.lvl-14 { border-left-color: #FF019B; }
.levelinfos-item.lvl-15 { border-left-color: #CC29C8; }
.levelinfos-item.lvl-16 { border-left-color: #4693EC; }
.levelinfos-item.lvl-17 { border-left-color: #1FB2F7; }
.levelinfos-item.lvl-18 { border-left-color: #00CBFF; }
.levelinfos-item.lvl-19 { border-left-color: #4CDBFF; }
.levelinfos-item.lvl-20 { border-left-color: #FFFFFF; }

.levelinfos-icon {
    width: 32px;
    height: 32px;
    flex-shrink: 0;
}

.levelinfos-info {
    flex: 1;
    min-width: 0;
}

.levelinfos-name {
    font-size: 13px;
    font-weight: 600;
    margin-bottom: 2px;
    color: #fff;
}

.levelinfos-range {
    font-size: 11px;
    color: #666;
}

.fc-user-logo {
    position: relative;
    cursor: help;
    display: inline-flex;
    align-items: center;
    justify-content: center;
}

.fc-user-logo-tooltip {
    position: fixed;
    padding: 10px 14px;
    border-radius: 8px;
    font-size: 12px;
    line-height: 1.4;
    color: #fff;
    white-space: nowrap;
    max-width: 90vw;
    z-index: 10000;
    pointer-events: none;
    opacity: 0;
    visibility: hidden;
    transition: opacity 0.2s ease, visibility 0.2s ease;
    background: rgba(0, 0, 0, 0.9);
    border: 1px solid #242424;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.7), 0 2px 8px rgba(0, 0, 0, 1);
    backdrop-filter: blur(7px);
    -webkit-backdrop-filter: blur(7px);
}

@-moz-document url-prefix() {
    .fc-user-logo-tooltip {
        backdrop-filter: none !important;
        background: rgba(0, 0, 0, 0.95);
    }
}

@media (max-width: 768px) {
    .team-background-table {
        flex-direction: column;
        gap: 30px;
    }

    .team-container {
        width: 100%;
    }
    .recommendation-content {
        gap: 10px;
        transform: translate(-50%, -50%);
    }

    .service-logo {
        width: 32px;
        height: 36px;
    }

    .recommendation-title {
        font-size: 14px;
    }

    .recommendation-subtitle {
        font-size: 11px;
    }

    .powered-by-badge {
        font-size: 9px;
    }

    .brand-icon-small {
        width: 20px;
        height: 20px;
    }

    .background-logo {
        background-size: 48px 54px, 48px 54px;
        background-position: 0 0, 24px 27px;
    }
}

@property --angle {
    syntax: "<angle>";
    initial-value: 0deg;
    inherits: false;
}

.fc-logo-container {
    position: relative;
    width: 44px;
    height: 44px;
}

.fc-logo-gradient {
    position: relative;
    width: 100%;
    height: 100%;
    border-radius: 8px;
    display: flex;
    justify-content: center;
    align-items: center;
}

.fc-logo-image {
    width: 44px;
    height: 44px;
    border-radius: 8px;
    position: relative;
    z-index: 1;
    transition: filter 0.2s ease;
    image-rendering: -webkit-optimize-contrast;
    image-rendering: crisp-edges;
    -ms-interpolation-mode: bicubic;
    filter: brightness(1) contrast(1.05);
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.fc-logo-container:hover .fc-logo-image {
    filter: brightness(var(--hover-brightness, 1.2)) contrast(1.05);
}

.fc-logo-gradient::before,
.fc-logo-gradient::after {
    content: '';
    position: absolute;
    height: 40px;
    width: 40px;
    border-radius: 8px;
    z-index: 0;
    background-image: conic-gradient(from var(--angle), #ff4500, #ff8c00, #ffcc00, #ff4500);
    animation: var(--animation-speed, 4s) logo-spin linear infinite;
}

.fc-logo-gradient::before {
    filter: blur(var(--border-blur, 4px));
    opacity: var(--border-opacity, 0.8);
}

@keyframes logo-spin {
    from { --angle: 0deg; }
    to { --angle: 360deg; }
}

#forecast-popup-container {
    position: fixed;
    z-index: 9999;
    filter: drop-shadow(0 4px 20px rgba(0,0,0,0.25));
    box-shadow: 0 4px 20px rgba(0,0,0,0.25);
    border-radius: 8px;
    overflow: hidden;
}

#forecast-popup-content {
    position: relative;
    width: 480px;
    height: 400px;
    border-radius: 12px;
    overflow: hidden;
    background-color: transparent;
    animation: fc-popup-appear 0.2s ease forwards;
}

@keyframes fc-popup-appear {
    from {
        opacity: 0;
        transform: scale(0.95);
    }
    to {
        opacity: 1;
        transform: scale(1);
    }
}

#forecast-popup-frame {
    border: none;
    width: 100%;
    height: 100%;
}

.brand-icon-positioned {
    position: absolute;
    right: 8px;
    top: 8px;
}

.elo-separated-container {
    display: flex;
    flex: 1 1 0;
    gap: 2px;
}

.elo-separated-col {
    flex-direction: column;
}

.elo-separated-row {
    flex-direction: row;
}

.elo-separated-flex {
    display: flex;
    flex: 0 1 0;
    gap: 8px;
    justify-content: space-between;
    align-items: center;
}

.elo-separated-holder {
    width: 100%;
    position: relative;
}

.elo-separated-progress-holder {
    display: flex;
    flex-direction: row;
    place-items: center;
}

.elo-separated-progress {
    width: 100%;
    height: 12px;
    border-radius: 2px;
    position: relative;
    box-sizing: border-box;
    background: rgba(255, 85, 0, 0.08);
    border: 1px solid rgba(255, 85, 0, 0.08);
}

.elo-separated-progress:last-child {
    margin: 0;
}

.elo-separated-progress::before {
    inset-block: 0;
    inset-inline-start: 0;
    width: var(--percent);
    border-radius: 2px;
    position: absolute;
    content: "";
    background: linear-gradient(270deg, rgb(255, 85, 0) 0%, rgba(255, 85, 0, 0.08) 100%);
}

.elo-separated-skill-icon {
    display: inline-block;
    vertical-align: sub;
    inline-size: 24px;
    block-size: 24px;
}

.elo-separated-text-muted {
    font-family: Play, sans-serif;
    letter-spacing: 0.02em;
    font-size: 12px;
    font-weight: normal;
    line-height: 16px;
    color: rgb(167, 167, 167);
}

.elo-separated-text-bold {
    font-family: Play, sans-serif;
    letter-spacing: 0.02em;
    font-size: 14px;
    font-weight: bold;
    line-height: 20px;
}

.fc-composite-cell {
    display: flex;
    align-items: center;
    flex-direction: row;
    justify-content: space-around;
    flex: 1 1 0;
}
</style>`;

