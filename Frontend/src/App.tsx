import {
	useState,
	useEffect,
	useCallback
} from "react";

import Dashboard from "./pages/Dashboard";

import "./css/App.css";

import type {
	AuthStatus,
	PairingCheck
} from "./types";

const API = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

export default function App() {
	const [ authStatus, setAuthStatus ] = useState<AuthStatus | null>( null );
	const [ pairing, setPairing ] = useState<PairingCheck | null>( null );
	const [ pairingVerifying, setPairingVerifying ] = useState( false );
	const [ error, setError ] = useState<string | null>( null );

	const checkPairing = useCallback(async () => {
        setPairingVerifying(true);
        try {
            const res = await fetch(`${API}/api/pairing/status`);
            const data: PairingCheck = await res.json();
            setPairing(data);
        } catch (e: unknown) {
            if (e instanceof Error) {
                setError( "Failed to check pairing status: " + e.message );
            } else {
                setError( "Failed to check pairing status: An unexpected error occurred" );
            }
        } finally {
            setPairingVerifying(false);
        }
    }, []);

	useEffect( () => {
		fetch( `${ API }/api/auth/status` )
			.then( res => res.json() )
			.then( ( data: AuthStatus ) => {
				setAuthStatus( data );
				if ( data.authenticated ) {
					checkPairing();
				}
			} )
			.catch( e => setError( `Cannot reach backend at ${ API }: ` + e ) );
	}, [ checkPairing ]);

	const onPairingVerified = () => {
		setPairing( { status: "paired" } );
	};

	const handleLogin = async () => {
		try {
			const res = await fetch( `${ API }/api/auth/url` );
			const data = await res.json();
			window.location.href = data.url;
		} catch ( e ) {
			setError( "Failed to get auth URL: " + e );
		}
	};

	const handleLogout = async () => {
		try {
			await fetch( `${ API }/api/auth/logout` );
			setAuthStatus( { authenticated: false, expires_at: null } );
			setPairing( null );
		} catch ( e ) {
			setError( "Failed to log out: " + e );
		}
	};

	if ( error ) return <pre>Error: { error }</pre>;
	if ( !authStatus ) return <p>Connecting...</p>;

	if ( !authStatus.authenticated ) {
		return (
			<div>
				<h1>Nikola</h1>
				<p>Not authenticated.</p>
				<button onClick={ handleLogin }>Login with Tesla</button>
			</div>
		);
	}

	return (
		<Dashboard
			onLogout={ handleLogout }
			pairing={ pairing }
			pairingVerifying={ pairingVerifying }
			onVerifyPairing={ checkPairing }
			onConfirmPairing={ onPairingVerified }
		/>
	);
}
