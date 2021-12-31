import { SecurityLogger } from "./security-logger.mjs";



const ROLL_MADE = "ROLL_MADE";
const ROLL_REQUEST = "ROLL_REQUEST";

class TaragnorSecurity {
	static async SecurityInit() {
		console.log("*** SECURITY ENABLED ***");
		game.socket.on("module.secure-foundry", this.socketHandler.bind(this));
	}

	static rollRequest(dice_expr = "1d6") {
		console.log("this", this);
		this.socketSend( {
			command: ROLL_REQUEST,
			target: "GameMaster", //shoudl be an id
			rollString: dice_expr,
		});
	}

	static rollSend(dice) {
		this.socketSend({
			command:ROLL_MADE,
			target: "PlayerId", // should be player Id
			dice,
		});
	}

	static async rollRecieve({dice: rollData}) {
		try {
			const roll = new Roll(rollData.formula);
			await roll.roll( {async: true});
			// console.log(`original total: ${roll.total}`);
			for (let i = 0; i < rollData.terms.length; i++)
				for (let j = 0; j< rollData.terms[i].results.length; j++)
					roll.terms[i].results[j].result = rollData.terms[i].results[j].result;
			roll._total = rollData.total;
			return roll;
		} catch (e) {
			console.error(e);
			console.log(rollData);
			return rollData;
		}
	}

	static socketSend(data) {
		// console.log("sending...");
		// console.log(data);
		game.socket.emit('module.secure-foundry', data);
	}

	static async socketHandler(data) {
		if (!data?.command)
			throw new Error("Malformed Socket Transmission");
		switch (data.command) {
			case ROLL_REQUEST:
				console.log("REQUEST RECIEVED");
				const dice = new Roll(data.rollString);
				await dice.roll({async:true});
				this.rollSend(dice);
				return true;
			case ROLL_MADE:
				const lastRoll = await this.rollRecieve(data) ;
				lastRoll.toMessage();
				window.lastRoll = lastRoll;
				return true;
			default:
				console.warn(`Unknown socket command: ${command}`);
				console.log(data);
				return true;
		}
	}

}

function socketTest() {
	socketSend({"test": "Sending shit"});
}




Hooks.on("ready", TaragnorSecurity.SecurityInit.bind(TaragnorSecurity));

window.rollRequest = TaragnorSecurity.rollRequest.bind(TaragnorSecurity);
