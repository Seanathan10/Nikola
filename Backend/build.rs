fn main() {
	println!( "[build.rs] compiling protos..." );
	prost_build::Config::new()
		.out_dir( "protobuf/" )
		.compile_protos(
			&[
				"protobuf/universal_message.proto",
				"protobuf/signatures.proto",
				"protobuf/vcsec.proto",
				"protobuf/common.proto",
				"protobuf/keys.proto",
				"protobuf/errors.proto",
				"protobuf/managed_charging.proto",
				"protobuf/car_server.proto",
				"protobuf/vehicle.proto",
			],
			&[ "protobuf/" ],
		).expect( "failed to compile Tesla proto files" );

	println!("[build.rs] finished compiling protos");
}
