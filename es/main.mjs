Hooks.on("ready", SecurityInit);

const ROLL_MADE = "ROLL_MADE";
const ROLL_REQUEST = "ROLL_REQUEST";

function SecurityInit() {
	console.log("*** SECURITY ENABLED ***");
	game.socket.on("module.secure-foundry", socketHandler);
}

function socketTest() {
	socketSend({"test": "Sending shit"});
}

function rollRequest(dice_expr = "1d6") {
	socketSend( {
		command: ROLL_REQUEST,
		target: "GameMaster", //shoudl be an id
		rollString: dice_expr,
	});
}

function rollSend(dice) {
	console.log("ROLL SEND");
	socketSend({
		command:ROLL_MADE,
		target: "PlayerId", // should be player Id
		dice,
	});
}

async function rollRecieve({dice: rollData}) {
	try {
		const roll = new Roll(rollData.formula);
		await roll.roll( {async: true});
		console.log(`original total: ${roll.total}`);
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

function socketSend(data) {
	console.log("sending...");
	console.log(data);
	game.socket.emit('module.secure-foundry', data);

}

async function socketHandler(data) {
	if (!data?.command)
		throw new Error("Malformed Socket Transmission");
	switch (data.command) {
		case ROLL_REQUEST:
			console.log("REQUEST RECIEVED");
			const dice = new Roll(data.rollString);
			await dice.roll({async:true});
			rollSend(dice);
			return true;
		case ROLL_MADE:
			const lastRoll =await rollRecieve(data) ;
			lastRoll.toMessage();
			window.lastRoll = lastRoll;
			return true;
		default:
			console.warn(`Unknown socket command: ${command}`);
			console.log(data);
			return true;
	}




}

window.rollRequest = rollRequest;

window.socketTest = socketTest;
