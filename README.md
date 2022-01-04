# Security Module for foundry
*Author:* Taragnor

Analyzes rolls to make sure players aren't cheating. All rolls are handled through the DM machine and recieve a "Roll Verified" message at the top of any messages that have been analyzed. Cheating messages will be highlighted in red (from DM perspective only) and suspicious messages will be highlighted in yellow. 

If a player is flagged as a cheater, it means he's either altered a roll or made a roll in a way that can't be monitored (for instance if a system only uses synchronous rolling). It can also occur if the player is using an old roll that was never posted. 

If a player is flagged as sus that means they've been making legitimate rolls but haven't posted all of them, or posted them out of order. 
The rolls themselves are verified, but they could be banking them and cherry picking the good ones to show. Some systems may get a false positive here if the system makes secret rolls and doesn't post them to chat in any way. 

*Note:* synchronous rolls such as inline rolls using double brackets in chat, aren't able to be analyzed in this way and as such should be considered insecure. 
