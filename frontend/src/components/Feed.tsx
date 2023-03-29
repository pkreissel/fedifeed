import React from 'react';
import { useEffect, useState } from 'react';
import { login, SerializerNativeImpl } from 'masto';

import Container from 'react-bootstrap/Container';
import Stack from 'react-bootstrap/esm/Stack';
import Form from 'react-bootstrap/Form';
import Status from './Status';
import Accordion from 'react-bootstrap/esm/Accordion';
import Spinner from 'react-bootstrap/Spinner';
import Alert from 'react-bootstrap/Alert';
import { usePersistentState } from 'react-persistent-state'
import { Button, Col, Row } from 'react-bootstrap';

export default function Feed(props: { token: string, server: string }) {
    const [isLoading, setLoading] = useState<boolean>(true); //loading state
    const [error, setError] = useState<string>(""); //error message
    const [feed, setFeed] = useState<any>([]); //feed to display
    const [rawFeed, setRawFeed] = useState<any>([]); //save raw feed for sorting without re-fetching
    const [api, setApi] = useState<any>(null); //save api object for later use
    const [userReblogs, setReblogs] = useState<any>([]); //save user reblogs for later use
    const [userFavs, setFavs] = useState<any>([]); //save user favs for later use
    const [userCoreServers, setCoreServers] = useState<any>([]); //save user core servers for later use
    const [userReblogWeight, setUserReblogWeight] = usePersistentState<number>(2, "reblogW"); //weight posts by accounts the user reblogs
    const [userFavWeight, setUserFavWeight] = usePersistentState<number>(1, "favW"); //weight posts by accounts the user favs
    const [topPostWeight, setTopPostWeight] = usePersistentState<number>(5, "topW"); //weight for top posts 
    const [frequencyWeight, setFrequencyWeight] = usePersistentState<number>(1, "frequW"); //weight for frequency
    const [timePenalty, setTimePenalty] = usePersistentState<number>(1, "timeW") //penalty for time since post

    useEffect(() => {
        const token = props.token;
        login({
            accessToken: token,
            url: props.server + '/api/v1/',
        }).then((masto) => {
            setApi(masto)
            constructFeed(masto)
        }).catch((err) => {
            setError(err);
            console.log(err)
        })
    }, []);

    useEffect(() => {
        let results = sortFeed(rawFeed, userReblogs, userCoreServers, userFavs);
        results = results.filter((status: any) => {
            return status.content.includes("RT @") === false
        })
        results = results.map((status: any) => {
            if (status.reblog) {
                status.reblog.value = status.value;
                status.reblog.reblog_by = status.account.acct;
                return status.reblog;
            }
            status.reblog_by = null;
            return status;
        })
        setFeed(results);
    }, [userReblogWeight, topPostWeight, frequencyWeight, timePenalty])

    async function constructFeed(masto: any) {

        const res = await fetch("/reblogs")
        if (!res.ok) {
            setError("Error fetching reblogs " + res.status);
            setLoading(false);
            return;
        }
        const reblogs = await res.json();
        setReblogs(reblogs);
        const res2 = await fetch("/core_servers")
        if (!res2.ok) {
            setError("Error fetching servers " + res2.status);
            setLoading(false);
            return;
        }
        const core_servers = await res2.json();
        setCoreServers(core_servers);
        const res3 = await fetch("/favorites")
        if (!res3.ok) {
            setError("Error fetching favs " + res3.status);
            setLoading(false);
            return;
        }
        const favs = await res3.json();
        setFavs(favs);
        Promise.all([
            getHomeFeed(masto),
            getTopPosts(core_servers),

        ])
            .then((data) => {
                console.log(data)
                let results = data.flat(1);
                setRawFeed(results);
                console.log(results.length)
                results = sortFeed(results, reblogs, core_servers, favs);
                results = results.filter((status: any) => {
                    return status.content.includes("RT @") === false
                })
                results = results.map((status: any) => {
                    if (status.reblog) {
                        status.reblog.value = status.value;
                        status.reblog.reblog_by = status.account.acct;
                        return status.reblog;
                    }
                    status.reblog_by = null;
                    return status;
                })
                setFeed(results);
                setLoading(false);
            })
            .catch((err) => {
                setError(err);
                console.log(err)
            })
    }

    async function getTopPosts(core_servers: any) {
        let results: any[] = [];
        const serializer = new SerializerNativeImpl();
        for (const server of Object.keys(core_servers)) {
            const res = await fetch(server + "/api/v1/trends/statuses")
            const data: any[] = serializer.deserialize('application/json', await res.text());
            results = results.concat(data.map((status: any) => {
                status.topPost = true;
                return status;
            }).slice(0, 5))
        }
        console.log(results)
        return results;
    }

    async function getHomeFeed(masto: any) {
        if (masto === null) masto = api;
        let results: any[] = [];
        let pages = 10;
        for await (const page of masto.v1.timelines.listHome()) {
            results = results.concat(page)
            pages--;
            if (pages === 0) {
                break;
            }
        }
        return results;
    }

    function sortFeed(array: any[], reblogs: any, core_servers: any, favs: any) {
        //how often a post is in the feed
        var frequency: any = {};

        array.forEach(function (value: { id: string, uri: string, account: any, reblog: any, topPost: any }) {
            if (!value?.account) {
                console.log("Error")
                console.log(typeof (value))
                console.log(value)
                return;
            }
            if (value.reblog) value.uri = value.reblog.uri;

            if (!(value.uri in frequency)) frequency[value.uri] = 0;

            if (value.account.acct in reblogs) frequency[value.uri] += reblogs[value.account.acct] * userReblogWeight;
            if (value.account.acct in favs) frequency[value.uri] += favs[value.account.acct] * userFavWeight;
            if (value.topPost) frequency[value.uri] += topPostWeight;
            frequency[value.uri] += frequencyWeight;
        });
        array = array.filter(item => item != undefined).filter(item => item.inReplyToId === null)
        array = [...new Map(array.map(item => [item["uri"], item])).values()];

        return array.map((item) => {
            const seconds = Math.floor((new Date().getTime() - new Date(item.createdAt).getTime()) / 1000);
            item.value = frequency[item.uri];
            item.value = item.value * (1 - (seconds * timePenalty / 86400));
            console.log(item)
            return item;
        }).sort(function (a, b) {
            return b.value - a.value
        })
    }

    const resolve = async (status: any): Promise<{ id: string }> => {
        const masto = api;
        if (status.uri.includes(props.server)) {
            return status;
        } else {
            const res = await masto.v2.search({ q: status.uri, resolve: true })
            return res.statuses[0]
        }
    }

    const reblog = async (status: any) => {
        const masto = api;
        const status_ = await resolve(status);
        const id = status_.id;
        (async () => {
            const res = await masto.v1.statuses.reblog(id);
            console.log(res);
        })();
    }

    const fav = async (status: any) => {
        const masto = api;
        const status_ = await resolve(status);
        const id = status_.id;
        (async () => {
            const res = await masto.v1.statuses.favourite(id);
            console.log(res);
        })();
    }


    return (
        <Container style={{ alignItems: "center" }} >
            <Row>
                <Col >
                </Col>
                <Col xs={6}>
                    <h1 style={{ textAlign: "center" }}>Feed</h1>
                </Col>
                <Col>
                    <Button variant="primary" href='/logout'>Logout</Button>
                </Col>
            </Row>
            <Accordion>
                <Accordion.Item eventKey="0">
                    <Accordion.Header>Feed Algorithmus</Accordion.Header>
                    <Accordion.Body>
                        <Form.Label style={{ textAlign: "center" }}>User Reblog Weight</Form.Label>
                        <Form.Range min="0" max="10" value={userReblogWeight} onChange={(event) => setUserReblogWeight(parseInt(event.target.value))} />
                        <Form.Label style={{ textAlign: "center" }}>User Fav Weight</Form.Label>
                        <Form.Range min="0" max="10" value={userFavWeight} onChange={(event) => setUserFavWeight(parseInt(event.target.value))} />
                        <Form.Label style={{ textAlign: "center" }}>Top Post Weight</Form.Label>
                        <Form.Range min="0" max="10" value={topPostWeight} onChange={(event) => setTopPostWeight(parseInt(event.target.value))} />
                        <Form.Label style={{ textAlign: "center" }}>Frequency Weight</Form.Label>
                        <Form.Range min="0" max="10" value={frequencyWeight} onChange={(event) => setFrequencyWeight(parseInt(event.target.value))} />
                        <Form.Label style={{ textAlign: "center" }}>Time Penalty</Form.Label>
                        <Form.Range min="0" max="1" step={0.1} value={timePenalty} onChange={(event) => setTimePenalty(parseFloat(event.target.value))} />
                    </Accordion.Body>
                </Accordion.Item>
            </Accordion>
            {isLoading &&
                <Spinner animation="border" style={{ justifySelf: "center" }} />
            }
            {error != "" &&
                <Alert variant="danger" style={{ justifySelf: "center" }}>
                    {error}
                </Alert>
            }
            <Stack gap={3} style={{ padding: "10px" }} className="mw-50">
                {feed.map((status: any) => {
                    return (
                        <Status status={status} reblog={reblog} fav={fav} key={status.id} />
                    )
                })}
            </Stack >
        </Container >
    )
}