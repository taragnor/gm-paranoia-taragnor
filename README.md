# Security Module for Foundry VTT
*Author:* Taragnor

Analyzes rolls to make sure players aren't cheating. All rolls are handled through the DM machine and recieve a "Roll Verified" message at the top of any messages that have been analyzed. The analysis message is visible only to the GM. Cheating messages will be highlighted in red and suspicious messages will be highlighted in yellow. 

If a player is flagged as a cheater, it means he's either altered a roll, used a very old roll, reused a roll or made a roll in a way that can't be monitored (for instance if a system only uses synchronous rolling). This should work with most systems though, as synchronous rolling is being deprecated in Foundry VTT,
so I would suspect most systems are using async by now. 

If a player is flagged as sus that means they've been making legitimate rolls but haven't posted all of them, or posted them out of order. 
The rolls themselves are verified, but they could be banking them and cherry picking the good ones to show. Some systems may get a false positive here if the system makes secret rolls and doesn't post them to chat in any way. 

## Caveats
Synchronous rolls such as inline rolls using double brackets in chat, aren't able to be analyzed in this way and as such should be considered insecure. 

This system will also generate false positives if there are multiple GMs. 

