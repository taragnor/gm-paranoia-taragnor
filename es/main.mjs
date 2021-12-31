import { SecurityLogger } from "./security-logger.mjs";



const ROLL_MADE = "ROLL_MADE";
const ROLL_REQUEST = "ROLL_REQUEST";
const logpath = "";

class TaragnorSecurity {
	static async SecurityInit() {
		console.log("*** SECURITY ENABLED ***");
		game.socket.on("module.secure-foundry", this.socketHandler.bind(this));
		this.logger = new SecurityLogger(logpath);
		this.awaitedRolls = [];
	}

	static rollRequest(dice_expr = "1d6", timestamp, targetGMId) {
		// console.log("Sending Roll request");
		this.socketSend( {
			command: ROLL_REQUEST,
			gm_id: targetGMId, //shoudl be an id
			rollString: dice_expr,
			timestamp,
			player_id: game.user.id
		});
	}

	static rollSend(dice, GMtimestamp, player_id, player_timestamp) {
		this.socketSend({
			command:ROLL_MADE,
			target: player_id, // should be player Id
			dice,
			timestamp: GMtimestamp,
			player_id,
			player_timestamp: player_timestamp,
		});
	}

	static async rollRecieve({dice: rollData, player_timestamp, player_id}) {
		try {
			const roll = new Roll(rollData.formula);
			await roll.roll( {async: true});
			// console.log(`original total: ${roll.total}`);
			for (let i = 0; i < rollData.terms.length; i++)
				for (let j = 0; j< rollData.terms[i].results.length; j++)
					roll.terms[i].results[j].result = rollData.terms[i].results[j].result;
			roll._total = rollData.total;
			const awaited = this.awaitedRolls.find( x=> x.timestamp == player_timestamp && player_id == game.user.id);
			awaited.resolve(roll);
			this.awaitedRolls = this.awaitedRolls.filter (x => x != awaited);
			return roll;
		} catch (e) {
			console.error(e);
			console.log(rollData);
			return rollData;
		}
	}

	static socketSend(data) {
		game.socket.emit('module.secure-foundry', data);
	}

	static async recievedRollRequest({gm_id, rollString, player_id, timestamp}) {
		if (!game.user.isGM || game.user.id != gm_id) {
			console.log("Disregarding recieved roll request");
			console.log(`${gm_id}`);
			return;
		}
		const dice = new Roll(rollString);
		await dice.roll({async:true});
		const gm_timestamp = this.logger.getTimeStamp();
		this.rollSend(dice, gm_timestamp, player_id, timestamp);
		await this.logger.logRoll(dice, player_id, gm_timestamp);
	}

	static async socketHandler(data) {
		if (!data?.command)
			throw new Error("Malformed Socket Transmission");
		switch (data.command) {
			case ROLL_REQUEST:
				await this.recievedRollRequest(data);
				return true;
			case ROLL_MADE:
				await this.rollRecieve(data);
				return true;
			default:
				console.warn(`Unknown socket command: ${command}`);
				console.log(data);
				return true;
		}
	}

	static async secureRoll (unevaluatedRoll) {
		if (typeof unevaluatedRoll == "string") {
			unevaluatedRoll = new Roll(unevaluatedRoll);
			console.log("Converted String roll to real roll");
		}
		if (game.user.isGM)  {
			return await unevaluatedRoll.roll({async: true});
		}
		return new Promise(( conf, rej) => {
			const timestamp = this.logger.getTimeStamp();
			this.awaitedRolls.push( {
				playerId: game.user.id,
				expr: unevaluatedRoll.formula,
				timestamp,
				resolve: conf,
				reject: rej,
			});
			const GMId = game.users.find( x=> x.isGM).id;
			this.rollRequest(unevaluatedRoll.formula, timestamp, GMId);

		});
	}

}

function socketTest() {
	socketSend({"test": "Sending shit"});
}




Hooks.on("ready", TaragnorSecurity.SecurityInit.bind(TaragnorSecurity));

window.secureRoll = TaragnorSecurity.secureRoll.bind(TaragnorSecurity);

window.rollRequest = TaragnorSecurity.rollRequest.bind(TaragnorSecurity);
