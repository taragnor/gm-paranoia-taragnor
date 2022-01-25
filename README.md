# Taragnor's GM Paranoia for Foundry VTT
*Author:* Taragnor

This module includes security measures for the paranoid GM to ensure players aren't engaging in anything sneaky. 

# GM-side Roll Scanning

Analyzes rolls to make sure players aren't fudging rolls. All rolls are requested through the GM machine and recieve a "Roll Verified" message at the top of any messages that have been analyzed. The analysis message is visible only to the GM. Cheating messages will be highlighted in red and suspicious messages will be highlighted in yellow. Note that when active, a player can't make rolls unless a GM is present in the server.  

If a player is flagged as a cheater, it means he's either altered a roll, used a very old roll, reused a roll or made a roll in a way that can't be monitored (for instance if a system only uses synchronous rolling). This should work with most systems though, as synchronous rolling is being deprecated in Foundry VTT,
so I would suspect most systems are using async by now. 

If a player is flagged as sus that means they've been making legitimate rolls but haven't posted all of them, or posted them out of order. 
The rolls themselves are verified, but they could be banking them and cherry picking the good ones to show. Some systems may get a false positive here if the system makes secret rolls and doesn't post them to chat in any way. 

## Caveats
Synchronous rolls such as inline rolls using double brackets in chat, aren't able to be analyzed in this way and as such should be considered insecure. 

This system has not been tested for multiple GMs. 

