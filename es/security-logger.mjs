export class SecurityLogger {
	static staleCounter = 70000;
	static recentCounter = 8000000;

	constructor (logPath) {
		this.startTime = Date.now();
		this.players = [];
		this.logs = [];
		this.startScan = false;
		this.reported= false;
		this.awaitedRolls = [];
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

	async playerSignIn(player_id) {
		this.players.push(player_id);
	}

	async logRoll(roll, player_id, gm_timestamp) {
		const logObj = {
			roll,
			player_id,
			timestamp:gm_timestamp,
			used: null,
			status: "unused"
		};
		this.logs.push(logObj );
		if (!this.logFileEnabled) return;
		//TODO: actually make a persistent log file

	}

	getNextId() {
		return this.logs.length;
	}

	checkBasicFind(roll) {
		try {
			const index = roll.options._securityId;
			const log = this.logs[index];
			if (log.timestamp == roll.options._securityTS)
				return log;
		} catch (e) {
			console.warn(e);
		}
		return null;
	}

	static checkStaleRoll(roll, timestamp) {
		try {
			const span = timestamp - roll.options._securityTS;
			if (Number.isNaN(span))
				throw new Error("NaN value");
			const stale  = span > SecurityLogger.staleCounter;
			if (stale)
				console.log(`Stale roll count: ${span}`);
			return stale;
		}catch (e) {
			console.error(e);
		}
		return false;
	}


	verifyRoll(roll, timestamp, player_id, chatlog_id) {
		const exists = this.checkBasicFind(roll, timestamp);
		const recentLogs = this.logs.filter( x=>
			x.player_id == player_id
			&& timestamp - x.timestamp < SecurityLogger.recentCounter
		);
		// const recentLogs = this.getRecentRolls(player_id, timestamp);
		// const already_done = recentLogs.find( x=> x.used == chatlog_id && SecurityLogger.rollsIdentical(x.roll, roll));
		if (!this.players.find( x=> x == player_id))
			return "no-report";
		if (!exists)
			return "not_found";
		if (!SecurityLogger.rollsIdentical(exists.roll, roll)){
			exists.status = "roll_modified";
			exists.used = chatlog_id;
			return exists.status;
		}
		if (exists.used == chatlog_id)
			return exists.status;
		if (exists.used)  {
			exists.status = "roll_used_multiple_times";
			exists.used = chatlog_id;
			return exists.status;
		}
		if (recentLogs.filter( x=> !x.used).length > 1) {
			exists.status = "unused_rolls";
			exists.used = chatlog_id;
			return exists.status;
		}
		if (SecurityLogger.checkStaleRoll(exists.roll, timestamp)) {
			exists.status = "stale";
			exists.used = chatlog_id;
			return exists.status;
		}
		exists.used = chatlog_id;
		exists.status = "verified";
		return exists.status;
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
		const logs =[...this.logs]
			.sort( (a,b) => {
				if (a.timestamp > b.timestamp) return -1;
				if (a.timestamp < b.timestamp) return 1;
				return 0;
			})
			.map( x=> {
				const timestamp = new Date(x.timestamp).toLocaleTimeString();
				return {
					timestamp,
					name: game.users.get(x.player_id).name,
					total: x.roll.total,
					used: x.used,
					terms: x.roll.getResultsArray(),
					formula: x.roll.formula,
					status: x.status
				};
			});
		const html = await renderTemplate("modules/gm-paranoia-taragnor/hbs/roll-log.hbs", { logs});
		return await this.logDialog(html);
	}

	logDialog(html) {
		return new Promise( (conf, rej) => {
			const options = { width: 700 };
			const dialog = new Dialog ( {
				title : "Roll Log",
				content :html,
				buttons : {
					one: {
						icon: `<i class="fas fa-check"></i>`,
						callback: () => conf(null),
					}
				},
				close: () => conf(null),
			}, options);
			dialog.render(true);
		});
	}

} //end of class



