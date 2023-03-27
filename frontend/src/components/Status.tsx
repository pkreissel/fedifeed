import React, { ReactElement } from 'react';
import parse from 'html-react-parser'
import Card from 'react-bootstrap/Card';
import Carousel from 'react-bootstrap/esm/Carousel';

export default function Status(props: { status: any }): ReactElement {
    const status = props.status;
    return (
        <Card className="min-h-100" border="light">
            <Card.Body>
                <img width={"10%"} src={status.account.avatar} alt="avatar" />
                <b style={{ padding: "10px" }}>{status.account.displayName}</b>
                <i>{status.account.username} </i>
                {status.topPost &&
                    <i>Top Post</i>
                }

                {status.reblog_by &&
                    <p>Reblog by {status.reblog_by}</p>
                }

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
                        <Card style={{ width: "533px" }}>
                            {
                                status.card.image === null &&
                                <Card.Img style={{ width: "533px", height: "300px", justifySelf: "center" }} variant="top" src={status.card.image} alt="card" />
                            }
                            <Card.Body>
                                <Card.Title>{status.card.title}</Card.Title>
                                <Card.Subtitle>{status.card.description}</Card.Subtitle>
                            </Card.Body>
                            <Card.Footer className="text-muted">{status.card.url}</Card.Footer>
                        </Card>
                    </a>

                }

                <Card.Link href={status.uri}>Status</Card.Link>
            </Card.Body>
            <Card.Footer className="text-muted">{status.id} - {status.createdAt} - Value: {status.value}</Card.Footer>

        </Card>
    )
}