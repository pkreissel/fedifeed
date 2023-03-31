import React, { ReactElement } from 'react';
import parse from 'html-react-parser'
import Card from 'react-bootstrap/Card';
import Carousel from 'react-bootstrap/esm/Carousel';
import Nav from 'react-bootstrap/Nav';
import NavDropdown from 'react-bootstrap/NavDropdown';

export default function Status(props: {
    status: any,
    fav: (status: any) => void,
    reblog: (status: any) => void,
    followUri: (status: any) => void
}): ReactElement {
    const [status, setStatus] = React.useState<any>(props.status);
    const handleSelect = (eventKey: any) => {
        console.log("eventKey")
        console.log(eventKey)
        switch (eventKey) {
            case "reblog":
                props.status.reblogged = true;
                props.status.reblogsCount += 1;
                props.reblog(status);
                setStatus(props.status);
                break;
            case "fav":
                props.fav(status);
                break;
            case "status":
                props.followUri(status);
                break;
            default:
                break;
        }
    }
    return (
        <Card bg={""} border={"secondary"}>
            <Card.Header style={{ background: "white" }}>
                {status.reblog_by &&
                    <p>Reblog by {status.reblog_by}</p>
                }
                <img width={"10%"} src={status.account.avatar} alt="avatar" />
                <b style={{ padding: "10px" }}>{status.account.displayName}</b>
                <i>{status.account.username} </i>
                {status.topPost &&
                    <i>Top Post</i>
                }
            </Card.Header>
            <Card.Body>
                {parse(status.content)}
                {status.mediaAttachments?.length > 0 &&
                    <Carousel>
                        {status.mediaAttachments?.map((media: any) => {
                            return (
                                <Carousel.Item>
                                    <img src={media.url} alt="media" style={{ height: "300px" }} />
                                </Carousel.Item>
                            )
                        })}
                    </Carousel>
                }
                {
                    status.card &&
                    <a href={status.card.url} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
                        <Card>
                            {
                                status.card.image !== null &&
                                <Card.Img variant="top" src={status.card.image} alt="card" />
                            }
                            <Card.Body>
                                <Card.Title>{status.card.title}</Card.Title>
                                <Card.Subtitle>{status.card.description}</Card.Subtitle>
                            </Card.Body>
                            <Card.Footer className="text-muted">{status.card.url}</Card.Footer>
                        </Card>
                    </a>

                }
                <Nav variant="pills" onSelect={handleSelect} >
                    <Nav.Item>
                        <Nav.Link eventKey="reblog" active={status.reblogged}>
                            {status.reblogsCount} Reblog
                        </Nav.Link>
                    </Nav.Item>
                    <Nav.Item>
                        <Nav.Link eventKey="fav" active={status.favorited}>
                            {status.favouritesCount} Fav
                        </Nav.Link>
                    </Nav.Item>
                    <NavDropdown title="More" id="nav-dropdown">
                        <NavDropdown.Item>
                            <Nav.Link eventKey="status">
                                Status Link
                            </Nav.Link>
                        </NavDropdown.Item>
                    </NavDropdown>
                </Nav>

            </Card.Body>
            <Card.Footer style={{ background: "white", border: "none" }}>
                {status.id} - {status.createdAt} - Value: {status.value}
            </Card.Footer>

        </Card>
    )
}