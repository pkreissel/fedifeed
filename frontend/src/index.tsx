import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { useEffect } from 'react';
import Feed from './components/Feed';
import Form from 'react-bootstrap/Form';
import Container from 'react-bootstrap/esm/Container';
import Button from 'react-bootstrap/Button';
import Card from 'react-bootstrap/esm/Card';

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
        <Container style={
            {
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100vh',
                width: '100vw',
            }
        }>
            <h1>Mastodon Smart-Feed</h1>
            <Container>
                <Form.Group className="mb-3" controlId="mastodon_server">
                    <Form.Label className="text-center w-100" htmlFor="mastodon_server">Enter Mastodon Server in the form: https://example.social</Form.Label >
                    <Form.Control type="url" id="mastodon_server" placeholder="https://mastodon.social" onChange={(e) => {
                        setServer(e.target.value);
                    }} />
                </Form.Group>
            </Container>

            <Button href={"/register?server=" + server}>Login</Button>
            <Card
                bg={"danger"}
                text={"white"}
                style={{ width: '18rem', marginTop: '100px' }}
                className="mb-2"
            >
                <Card.Header>Attention</Card.Header>
                <Card.Body>
                    <Card.Text>
                        This is a demo application. It might contain security issues. Please use at your own risk.
                    </Card.Text>
                </Card.Body>
            </Card>
        </Container>
    )


};
ReactDOM.render(<App />, document.getElementById('app'));