pub mod signatures {
	include!( "../protobuf/signatures.rs" );
}

pub mod keys {
	include!( "../protobuf/keys.rs" );
}

pub mod errors {
	include!( "../protobuf/errors.rs" );
}

pub mod universal_message {
	include!( "../protobuf/universal_message.rs" );
}

pub mod vcsec {
	include!( "../protobuf/vcsec.rs" );
}

pub mod car_server {
	include!( "../protobuf/car_server.rs" );
}

pub mod managed_charging {
	include!( "../protobuf/managed_charging.rs" );
}
