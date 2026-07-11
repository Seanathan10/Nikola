import { circuits } from "./Materials";

let pending: ReturnType<typeof setTimeout>[] = [];

export function HeadAndTailLights( blinks = 2 ) {
	pending.forEach(clearTimeout);
	pending = [];

	const on = 260;
	const off = 160;
	let at = 0;

	for (let n = 0; n < blinks; n++) {
		pending.push(setTimeout(() => (circuits.headlight = true), at));
		pending.push( setTimeout( () => (circuits.tail = true ), at ) );
		pending.push( setTimeout( () => (circuits.brake = true ), at ) );
		at += on;
		pending.push(setTimeout(() => (circuits.headlight = false), at));
		pending.push( setTimeout( () => (circuits.tail = false ), at ) );
		pending.push( setTimeout( () => (circuits.brake = false ), at ) );
		at += off;
	}
}


export function Headlights(blinks = 2) {
	pending.forEach(clearTimeout);
	pending = [];

	const on = 260;
	const off = 160;
	let at = 0;

	for (let n = 0; n < blinks; n++) {
		pending.push(setTimeout(() => (circuits.headlight = true), at));
		at += on;
		pending.push(setTimeout(() => (circuits.headlight = false), at));
		at += off;
	}
}

export function Taillights( blinks = 2 ) {
	pending.forEach(clearTimeout);
	pending = [];

	const on = 260;
	const off = 160;

	let at = 0;

	for (let n = 0; n < blinks; ++n) {
		pending.push( setTimeout( () => (circuits.tail = true ), at ) );
		pending.push( setTimeout( () => (circuits.brake = true ), at ) );
		at += on;
		pending.push( setTimeout( () => (circuits.tail = false ), at ) );
		pending.push( setTimeout( () => (circuits.brake = false ), at ) );
		at += off;
	}
}
