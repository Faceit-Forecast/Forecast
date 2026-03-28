[1.7.9] Matchroom Redesign & Reliability
Redesigned team and player statistics in match room with map icons and average kills display
Added option to switch between new and classic table views for match room stats
Added Average ELO column in match history - shows your team's and enemy team's average elo
Added automatic server switching to mitigate regional network restrictions
Extension now works on club, team leagues and team stats pages
Match room data now retries loading if FACEIT servers respond slowly
Fixed level icons not appearing correctly on updated FACEIT pages
Fixed duplicate level icons in match history
Improved overall extension performance and stability
<img width="812" height="433" alt="image" src="https://github.com/user-attachments/assets/2000dfb0-f2c9-493b-8f4b-935b5dbe2988" />
<img width="417" height="409" alt="image" src="https://github.com/user-attachments/assets/9c643682-2e88-42c1-977e-84bfefbcc450" />
<img width="294" height="477" alt="image" src="https://github.com/user-attachments/assets/b0c0c0d3-8c63-4263-8ead-312a9d8618fd" />

[1.7.8] Authorization & Performance
Added FACEIT account authorization
Added badges for authenticated users
Added Anubis to map pool for quick position setup feature
Added remote map pool control for faster updates
Improved caching for faster loading and reduced requests to FACEIT data API
Adapted match history for new FACEIT web structure
Match history stats rounding is now a feature
Fixed bug when match history would not load
Fixed bug when some Forecast elements would appear incorrectly
Removed ELO calculation in match history, as it's now implemented by FACEIT

[1.7.7] Bug Fixes
Fixed level icon not appearing on player profiles
Improved About tab in extension popup

[1.7.6] FCR Rating & Bug Fixes
Improved extension performance and loading speed
Fixed match room not loading in certain conditions
Fixed Quick Pos Setup not saving text input
Replaced RWS with FCR (Forecast Rating) - your team contribution percentage (0-100%)
FCR is calculated from kills, assists, ADR, entry frags, clutches and utility usage
FCR ideal score is 20% when all 5 players contribute equally
FCR color coded: green (≥20%), yellow (15-20%), red (<15%)
Match history popup now sorted by ADR
Internal code improvements and optimizations
<img width="587" height="394" alt="image" src="https://github.com/user-attachments/assets/73585e64-264b-4c32-89b7-60fb7b1fd608" />

[1.7.5] Match History Enhancements
Fixed duplicate popup appearing in match history
Fixed duplicate level indicators on player profiles
Added colored statistics display (KDA, ADR, K/D, K/R)
Added RWS (Round Win Share) statistics to the match history column
Added ELO changes display for each match
New popup settings for match history features
Match history popup now sorted by RWS performance
Match history popup now stores each player’s ELO
<img width="1101" height="232" alt="image" src="https://github.com/user-attachments/assets/38a36823-724b-4e42-b17c-12351fa8ee86" />
<img width="489" height="410" alt="image" src="https://github.com/user-attachments/assets/f276f12d-2bbd-4e7f-b3ca-e88980a0c013" />


[1.7.4] UI Refresh & Cleanup
Refactored styles to adapt to new Faceit design
Removed HLTV Rating feature
