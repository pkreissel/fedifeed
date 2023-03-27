import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { useEffect } from 'react';
import Feed from './components/Feed';

const App: React.FC = () => {
    const [server, setServer] = React.useState<string>('');
    const loggedIn = document.getElementById('login_status').dataset.login === 'True';

    if (loggedIn) {
        const token = document.getElementById('login_status').dataset.token;
        const server = document.getElementById('login_status').dataset.server;
        return <Feed token={token} server={server} />;
    }
    //show mastodon server input
    return (
        <div style={
            {
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100vh',
                width: '100vw',
            }
        }>
            <div>
                <input type="text" id="mastodon_server" placeholder="Mastodon Server" onChange={(e) => {
                    setServer(e.target.value);
                }} />
            </div>
            <a href={"/register?server=" + server}>Login</a>
        </div>
    )


};
ReactDOM.render(<App />, document.getElementById('app'));