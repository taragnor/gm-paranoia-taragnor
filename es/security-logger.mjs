export class SecurityLogger {
	constructor (logPath) {
		this.startTime = Date.now();
		this.logs = [];
		if (!logPath) {
			this.logFileEnabled = false;
			return;
		}
		this.logPath = logPath;
		this.logFileEnabled = true;
		this.loadFile(logPath)
		//TODO: Setup log file logic
	}

	async loadFile(logPath) {

	}

	async logRoll(roll, player_id, gm_timestamp) {
		const logObj = {
			roll,
			player_id,
			timestamp:gm_timestamp,
			used: null
		};
		this.logs.push(logObj );
		// console.log( "Logged", logObj);
		if (!this.logFileEnabled) return;
		//TODO: actually write to file

	}

	verifyRoll(roll, timestamp, player_id, chatlog_id) {
		const recentLogs = this.getRecentRolls(player_id, timestamp);
		const log =  recentLogs.find(x=>
			SecurityLogger.rollsIdentical(x.roll, roll)
		);
		if (!log) {
			// console.warn("Roll not found in database");
			return "not found";
		}
		if (log.used && chatlog_id != log.used) {
			// console.warn("Roll was already used");
			return "roll_used";
		}
		if (recentLogs.filter( x=> !x.used).length > 1)
			return "sus";
		if (log.used && chatlog_id != log.used) {
			return "already_done";
		}
		log.used = chatlog_id;
		return "verified";
	}

	static rollsIdentical(rollA, rollB) {
		try {
			if (rollA.total != rollB.total)
				return false;
			return rollA.terms.every( (term, i) => {
				if (!term?.results) return true;
				return term.results.every( (result, j) => {
					return result.result == rollB.terms[i].results[j].result;
				})
			});
		} catch (e) {
			console.error(e);
			return false;
		}
	}

	getRecentRolls(player_id, timestamp) {
		return this.logs.filter( x=> x.player_id == player_id &&
			timestamp - x.timestamp < 50000
		);
	}

	getTimeStamp() {
		return Date.now();
	}

	async viewLog() {
		const logs = this.logs.map( x=> {
			return {
				timestamp: new Date(x.timestamp).toLocaleTimeString(), //TODO: convert to real time
				name: game.users.get(x.player_id).name,
				total: x.roll.total,
				used: x.used,
				terms: x.roll.getResultsArray()
			};
		});
		const html = await renderTemplate("modules/foundry-security/hbs/roll-log.hbs", { logs});
	}

} //end of class



