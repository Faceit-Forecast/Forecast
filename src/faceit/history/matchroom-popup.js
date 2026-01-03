/*
 * Copyright (c) 2025 TerraMiner. All Rights Reserved.
 */

function formatDecimal(value) {
    const num = parseFloat(value);
    if (isNaN(num)) return value;
    return num.toFixed(1);
}

class MatchroomPopup {
    constructor(table, settings) {
        this.wrapper = table.querySelector("[class~=popup-wrapper]");
        this.popup = this.wrapper.children[0];
        this.settings = settings;
        this.popup.addEventListener('click', function (event) {
            event.preventDefault();
            event.stopPropagation();
        });
    }

    attachToElement(stats, playerId) {
        const tables = [
            this.popup.querySelector(`#team-table-body-popup-1`),
            this.popup.querySelector(`#team-table-body-popup-2`),
        ];

        if (tables[0]?.children.length > 0 || tables[1]?.children.length > 0) {
            return;
        }

        const sortByADR = (players) => players.sort((a, b) =>
            (parseFloat(b.player_stats["ADR"]) || 0) - (parseFloat(a.player_stats["ADR"]) || 0)
        );
        const teams = [
            sortByADR(stats.rounds[0].teams[0].players),
            sortByADR(stats.rounds[0].teams[1].players),
        ];


        const createRow = (playerStats) => {
            const row = document.createElement("tr");
            row.className = "popup-table-row"
            const stats = playerStats["player_stats"];
            const rating = stats["Rating"];
            const elo = playerStats.elo;
            const ratingValue = rating !== null && rating !== undefined
                ? (typeof rating === 'number' ? rating.toFixed(1) + '%' : rating + '%')
                : "-";

            const data = [
                playerStats.nickname,
                stats["Kills"],
                stats["Assists"],
                stats["Deaths"],
                formatDecimal(stats["K/R Ratio"]),
                formatDecimal(stats["K/D Ratio"]),
                stats["Headshots"],
                formatDecimal(stats["ADR"]),
                ratingValue,
                elo !== null ? elo : "-",
            ];

            data.forEach((value, index) => {
                let cell = document.createElement("td");
                cell.className = "popup-table-cell"
                if (index === 0 && playerId === playerStats.player_id) {
                    cell.style.color = "#FF5500";
                    cell.style.fontWeight = "bold";
                }
                cell.textContent = value;
                row.appendChild(cell);
            });

            return row;
        };

        for (let index = 0; index < teams.length; index++) {
            let team = teams[index];
            const table = tables[index];
            const rows = team.map(createRow);
            table.append(...rows);
        }
    }
}
