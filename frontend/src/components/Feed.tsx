import React, { useMemo } from 'react';
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
import { Button, Col, Navbar, Row } from 'react-bootstrap';
import { weightsType, StatusType } from '../types';

export default function Feed(props: { token: string, server: string }) {
    const [isLoading, setLoading] = useState<boolean>(true); //loading state
    const [error, setError] = useState<string>(""); //error message
    const [feed, setFeed] = useState<StatusType[]>([]); //feed to display
    const [rawFeed, setRawFeed] = useState<StatusType[]>([]); //save raw feed for sorting without re-fetching
    const [seenFeed, setSeenFeed] = usePersistentState<StatusType[]>(new Array(), "seen");
    const [api, setApi] = useState<any>(null); //save api object for later use
    const [userReblogs, setReblogs] = useState<any>([]); //save user reblogs for later use
    const [userFavs, setFavs] = useState<any>([]); //save user favs for later use
    const [userCoreServers, setCoreServers] = useState<any>([]); //save user core servers for later use
    const [userReblogWeight, setUserReblogWeight] = usePersistentState<number>(2, "reblogW"); //weight posts by accounts the user reblogs
    const [userFavWeight, setUserFavWeight] = usePersistentState<number>(1, "favW"); //weight posts by accounts the user favs
    const [topPostWeight, setTopPostWeight] = usePersistentState<number>(2, "topW"); //weight for top posts 
    const [frequencyWeight, setFrequencyWeight] = usePersistentState<number>(3, "frequW"); //weight for frequency
    const [activePenalty, setActivePenalty] = usePersistentState<number>(0.8, "activeW") //penalty for active accounts
    const [timePenalty, setTimePenalty] = usePersistentState<number>(1, "timeW") //penalty for time since post
    const [autoAdjust, setAutoAdjust] = usePersistentState<boolean>(true, "autoAdjust") //auto adjust weights
    const topRef = React.useRef<HTMLDivElement>(null);
    const seenFeedLength = useMemo(() => {
        console.log("seen feed length: " + seenFeed.length)
        return seenFeed.length
    }, [])
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
        console.log("resorting feed")
        if (autoAdjust) return
        let results = sortFeed(rawFeed, userReblogs, userCoreServers, userFavs);
        setFeed(results);
    }, [userReblogWeight, topPostWeight, frequencyWeight, userFavWeight, timePenalty, activePenalty])

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
                console.log(results.slice(0, 50).map((status: any) => status.content).join(""))
                setFeed(results);
                setLoading(false);
                console.log(topRef)
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

    function sortFeed(array: StatusType[], reblogs: any, core_servers: any, favs: any): StatusType[] {
        //how often a post is in the feed
        var weights: { [key: string]: weightsType } = {};
        var accounts: { [key: string]: number } = {};

        array.forEach(function (item: StatusType) {
            if (!item?.account) {
                console.log("Error")
                console.log(typeof (item))
                console.log(item)
                return;
            }
            if (item.reblog) item.uri = item.reblog.uri;

            if (!(item.uri in weights)) weights[item.uri] = {
                "userReblogWeight": 0,
                "userFavWeight": 0,
                "topPostWeight": 0,
                "frequencyWeight": 0
            }

            const weight: weightsType = {
                "userReblogWeight": (item.account.acct in reblogs) ? reblogs[item.account.acct] * userReblogWeight : 0,
                "userFavWeight": (item.account.acct in favs) ? favs[item.account.acct] * userFavWeight : 0,
                "topPostWeight": item.topPost ? topPostWeight : 0,
                "frequencyWeight": frequencyWeight
            }
            for (let key in weight) {
                if (weights[item.uri].hasOwnProperty(key)) {
                    weights[item.uri][key] += weight[key]
                }
            }
        });
        const seenUris = [...seenFeed].map((item) => item.uri);
        array = array
            .filter(item => item != undefined)
            .filter(item => item.inReplyToId === null)
            .filter((item: StatusType) => item.content.includes("RT @") === false)
            .filter((item: StatusType) => !item.reblogged)


        array = [...new Map(array.map(item => [item["uri"], item])).values()];

        const sortedArray = array.map((item) => {
            item.weights = weights[item.uri]
            item.value = Object.values(weights[item.uri]).reduce((accumulator, currentValue) => accumulator + currentValue, 0);
            return item;
        }).sort(function (a, b) {
            return b.value - a.value
        })
        const mixedArray = sortedArray.map((item) => {
            if (item.account.acct in accounts) {
                accounts[item.account.acct] += 1;
            } else {
                accounts[item.account.acct] = 1;
            }
            const seconds = Math.floor((new Date().getTime() - new Date(item.createdAt).getTime()) / 1000);
            const timediscount = Math.pow((1 + timePenalty * 0.2), -Math.pow((seconds / 3600), 2));
            item.value = item.value * timediscount
            item.value = item.value * Math.pow(activePenalty, accounts[item.account.acct])
            return item;
        }).sort(function (a, b) {
            return b.value - a.value
        })

        const finalArray = mixedArray.map((status: any) => {
            if (status.reblog) {
                status.reblog.value = status.value;
                status.reblog.weights = status.weights
                status.reblog.reblog_by = status.account.acct;
                return status.reblog;
            }
            status.reblog_by = null;
            return status;
        })
        return finalArray
    }

    const resolve = async (status: StatusType): Promise<StatusType> => {
        const masto = api;
        if (status.uri.includes(props.server)) {
            return status;
        } else {
            const res = await masto.v2.search({ q: status.uri, resolve: true })
            return res.statuses[0]
        }
    }

    const reblog = async (status: StatusType) => {
        const masto = api;
        const status_ = await resolve(status);
        weightAdjust(status.weights)
        const id = status_.id;
        (async () => {
            const res = await masto.v1.statuses.reblog(id);
            console.log(res);
        })();
    }

    const fav = async (status: StatusType) => {
        console.log(status.weights)
        const masto = api;
        const status_ = await resolve(status);
        weightAdjust(status.weights)
        const id = status_.id;
        (async () => {
            const res = await masto.v1.statuses.favourite(id);
            console.log(res);
        })();
    }

    const followUri = async (status: StatusType) => {
        const status_ = await resolve(status);
        weightAdjust(status.weights)
        console.log(status_)
        window.open(props.server + "/@" + status_.account.acct + "/" + status_.id, "_blank");
    }

    const followLink = async (status: StatusType) => {
        weightAdjust(status.weights)
        window.open(status.card.url, "_blank");
    }

    const onView = async (status: StatusType) => {
        console.log(status.account.acct)
        const status_ = { ...status };
        status_.value = -1
        seenFeed.push(status_)
        const seenFeedSet = new Set(seenFeed)
        const seenFeedArray = [...seenFeedSet].filter((item) => {
            const seconds = Math.floor((new Date().getTime() - new Date(item.createdAt).getTime()) / 1000);
            return seconds < 3600 * 24
        })
        setSeenFeed(seenFeedArray)
    }

    const weightAdjust = (weight: weightsType) => {
        if (autoAdjust === false) return;
        console.log(weight)
        if (weight == undefined) return;
        const mean = Object.values(weight).reduce((accumulator, currentValue) => accumulator + currentValue, 0) / Object.values(weight).length;
        for (let key in weight) {
            if (weight.hasOwnProperty(key)) {
                weight[key] = weight[key] / mean;
            }
        }
        const currentWeight: weightsType = {
            "userReblogWeight": userReblogWeight,
            "userFavWeight": userFavWeight,
            "topPostWeight": topPostWeight,
            "frequencyWeight": frequencyWeight
        }
        const currentMean = Object.values(weight).reduce((accumulator, currentValue) => accumulator + currentValue, 0) / Object.values(weight).length;
        setUserReblogWeight(userReblogWeight + 0.1 * userReblogWeight * weight["userReblogWeight"] / (currentWeight["userReblogWeight"] / currentMean))
        setUserFavWeight(userFavWeight + 0.1 * userFavWeight * weight["userFavWeight"] / (currentWeight["userFavWeight"] / currentMean))
        setTopPostWeight(topPostWeight + 0.1 * topPostWeight * weight["topPostWeight"] / (currentWeight["topPostWeight"] / currentMean))
        setFrequencyWeight(frequencyWeight + 0.1 * frequencyWeight * weight["frequencyWeight"] / (currentWeight["frequencyWeight"] / currentMean))
    }

    return (
        <Container style={{ alignItems: "center" }} >
            <Container style={{ position: "fixed", zIndex: 20, background: "white" }}>
                <Row>
                    <Col>
                    </Col>
                    <Col xs={6}>
                        <h1 style={{ textAlign: "center" }}>Feed</h1>
                    </Col>
                    <Col>
                        <Button variant="primary" href='/logout'>Logout</Button>
                    </Col>
                </Row>
                <Row>
                    <Accordion>
                        <Accordion.Item eventKey="0">
                            <Accordion.Header>Feed Algorithmus</Accordion.Header>
                            <Accordion.Body>
                                <Form.Label style={{ textAlign: "center" }}>Show more Posts of Users you reblogged in the past. {userReblogWeight}</Form.Label>
                                <Form.Range min="0" max="10" step={0.1} value={userReblogWeight} onChange={(event) => setUserReblogWeight(parseInt(event.target.value))} />
                                <Form.Label style={{ textAlign: "center" }}>Show more Posts of Users you faved in the past. {userFavWeight}</Form.Label>
                                <Form.Range min="0" max="10" step={0.1} value={userFavWeight} onChange={(event) => setUserFavWeight(parseInt(event.target.value))} />
                                <Form.Label style={{ textAlign: "center" }}>Show more Trending Posts from your favorite Servers {topPostWeight}</Form.Label>
                                <Form.Range min="0" max="10" step={0.1} value={topPostWeight} onChange={(event) => setTopPostWeight(parseInt(event.target.value))} />
                                <Form.Label style={{ textAlign: "center" }}>Show more Posts that were repeatedly reposted in your feed {frequencyWeight}</Form.Label>
                                <Form.Range min="0" max="10" step={0.1} value={frequencyWeight} onChange={(event) => setFrequencyWeight(parseInt(event.target.value))} />
                                <Form.Label style={{ textAlign: "center" }}>Time Penalty {timePenalty}</Form.Label>
                                <Form.Range min="0" max="1" step={0.1} value={timePenalty} onChange={(event) => setTimePenalty(parseFloat(event.target.value))} />
                                <Form.Label style={{ textAlign: "center" }}>Reduce frequency highly active users would appear in the feed</Form.Label>
                                <Form.Range min="0" max="1" step={0.1} value={activePenalty} onChange={(event) => setActivePenalty(parseFloat(event.target.value))} />
                                <Form.Label style={{ textAlign: "center" }}>Auto Adjust Weights (if you interact with a post, the weights will "learn")</Form.Label>
                                <Form.Check type="switch" id="custom-switch" label="" checked={autoAdjust} onChange={(event) => setAutoAdjust(event.target.checked)} />
                            </Accordion.Body>
                        </Accordion.Item>
                    </Accordion>
                </Row>
            </Container>
            {isLoading &&
                <Spinner animation="border" style={{ justifySelf: "center" }} />
            }
            {error != "" &&
                <Alert variant="danger" style={{ justifySelf: "center" }}>
                    {error}
                </Alert>
            }
            <Stack gap={3} style={{ padding: "10px", paddingTop: "120px", maxWidth: "800px", justifyContent: "center", justifySelf: "center" }} className="mw-40">
                {feed.map((status: any, index) => {
                    console.log(index === seenFeedLength)
                    return (
                        <Status
                            onView={onView}
                            status={status}
                            reblog={reblog}
                            fav={fav}
                            followUri={followUri}
                            followLink={followLink}
                            key={status.id}
                            isTop={index === seenFeedLength}
                        />
                    )
                })}
            </Stack >
        </Container >
    )
}
