/*
 * Copyright (c) 2025 TerraMiner. All Rights Reserved.
 */

class MatchroomPopup {
    constructor(table) {
        this.wrapper = table.querySelector("[class~=popup-wrapper]");
        this.popup = this.wrapper.children[0];
        this.popup.addEventListener('click', function(event) {
            event.preventDefault();
            event.stopPropagation();
        });
    }

    attachToElement(stats, playerId) {
        const sortByKills = (players) => players.sort((a, b) => b.player_stats["Kills"] - a.player_stats["Kills"]);
        const teams = [
            sortByKills(stats.rounds[0].teams[0].players),
            sortByKills(stats.rounds[0].teams[1].players),
        ];

        const tables = [
            this.popup.querySelector(`#team-table-body-popup-1`),
            this.popup.querySelector(`#team-table-body-popup-2`),
        ];

        const createRow = (playerStats) => {
            const row = document.createElement("tr");
            row.className = "popup-table-row"
            const stats = playerStats["player_stats"];
            const data = [
                playerStats.nickname,
                stats["Kills"],
                stats["Assists"],
                stats["Deaths"],
                stats["K/R Ratio"],
                stats["K/D Ratio"],
                stats["Headshots"],
                stats["Headshots %"],
                stats["MVPs"],
                stats["ADR"],
            ];

            data.forEach((value, index) => {
                let cell = document.createElement("td");
                cell.className = "popup-table-cell"
                if (index === 0 && playerId === playerStats.player_id) {
                    cell.style.color = "#FF5500FF";
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
