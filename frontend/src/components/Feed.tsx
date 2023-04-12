import React, { useMemo, useRef } from 'react';
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
import sortFeed from '../utils/theAlgorithm';
import useOnScreen from '../utils/useOnScreen';
import reblogsFeature from '../features/reblogsFeature';
import favsFeature from '../features/favsFeature';
import coreServersFeature from '../features/coreServerFeature';
import topPostsFeed from '../feeds/topPostsFeed';
import homeFeed from '../feeds/homeFeed';

export default function Feed(props: { token: string, server: string }) {
    const [isLoading, setLoading] = useState<boolean>(true); //loading state
    const [error, setError] = useState<string>(""); //error message
    const [feed, setFeed] = useState<StatusType[]>([]); //feed to display
    const [records, setRecords] = useState<number>(20); //how many records to show
    const [rawFeed, setRawFeed] = useState<StatusType[]>([]); //save raw feed for sorting without re-fetching
    const [seenFeed, setSeenFeed] = usePersistentState<StatusType[]>(new Array(), "seen");
    const [api, setApi] = useState<any>(null); //save api object for later use
    //Features:
    const [userReblogs, setReblogs] = useState<any>([]); //save user reblogs for later use
    const [userFavs, setFavs] = useState<any>([]); //save user favs for later use
    const [userCoreServers, setCoreServers] = useState<any>([]); //save user core servers for later use
    //Weights
    const [userReblogWeight, setUserReblogWeight] = usePersistentState<number>(2, "reblogW"); //weight posts by accounts the user reblogs
    const [userFavWeight, setUserFavWeight] = usePersistentState<number>(1, "favW"); //weight posts by accounts the user favs
    const [topPostWeight, setTopPostWeight] = usePersistentState<number>(2, "topW"); //weight for top posts 
    const [frequencyWeight, setFrequencyWeight] = usePersistentState<number>(3, "frequW"); //weight for frequency
    //Penalty
    const [activePenalty, setActivePenalty] = usePersistentState<number>(0.8, "activeW") //penalty for active accounts
    const [timePenalty, setTimePenalty] = usePersistentState<number>(1, "timeW") //penalty for time since post
    //User Setting
    const [autoAdjust, setAutoAdjust] = usePersistentState<boolean>(true, "autoAdjust") //auto adjust weights

    const bottomRef = useRef<HTMLDivElement>(null);
    const isBottom = useOnScreen(bottomRef)
    const topRef = React.useRef<HTMLDivElement>(null);
    const seenFeedLength = useMemo(() => {
        console.log("seen feed length: " + seenFeed.length)
        return seenFeed.length
    }, [])

    //Contruct Feed on Page Load
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

    //Sort Feed on Manual Weight Change
    useEffect(() => {
        if (autoAdjust) return
        const results = sortFeed(rawFeed, userReblogs, userCoreServers, userFavs, seenFeed, userReblogWeight, userFavWeight, topPostWeight, frequencyWeight, activePenalty, timePenalty)
        setFeed(results);
    }, [userReblogWeight, topPostWeight, frequencyWeight, userFavWeight, timePenalty, activePenalty])

    //Load More Posts on Scroll
    useEffect(() => {
        if (isBottom) {
            console.log("bottom")
            if (records < feed.length) {
                setRecords(records + 20)
            } else {
                setRecords(feed.length)
            }
        }
    }, [isBottom])

    async function constructFeed(masto: any) {
        //Fetche Features and Feeds, pass to Algorithm
        const featureFuncs = [reblogsFeature, coreServersFeature, favsFeature]
        const features = Promise.all(featureFuncs.map((func) => func()))
        const [reblogs, core_servers, favs] = await features
        setReblogs(reblogs);
        setCoreServers(core_servers);
        setFavs(favs);
        const feeds = Promise.all([
            homeFeed(masto),
            topPostsFeed(core_servers),
        ])
        let results = (await feeds).flat(1);
        setRawFeed(results);
        results = sortFeed(results, reblogs, core_servers, favs, seenFeed, userReblogWeight, userFavWeight, topPostWeight, frequencyWeight, activePenalty, timePenalty);
        console.log(results)
        setFeed(results);
        setLoading(false);
    }



    const resolve = async (status: StatusType): Promise<StatusType> => {
        //Resolve Links to other instances on homeserver
        const masto = api;
        if (status.uri.includes(props.server)) {
            return status;
        } else {
            const res = await masto.v2.search({ q: status.uri, resolve: true })
            return res.statuses[0]
        }
    }

    const reblog = async (status: StatusType) => {
        //Reblog a post
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
        //Favourite a post
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
        //Follow a link to another instance on the homeserver
        const status_ = await resolve(status);
        weightAdjust(status.weights)
        console.log(status_)
        window.open(props.server + "/@" + status_.account.acct + "/" + status_.id, "_blank");
    }

    const followLink = async (status: StatusType) => {
        //Follow an article link
        weightAdjust(status.weights)
        window.open(status.card.url, "_blank");
    }

    const onView = async (status: StatusType) => {
        //Mark a post as seen
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
        //Adjust Weights based on user interaction
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
                    return (
                        <Status
                            onView={onView}
                            status={status}
                            reblog={reblog}
                            fav={fav}
                            followUri={followUri}
                            followLink={followLink}
                            key={status.id}
                            isTop={false}
                        />
                    )
                })}
            </Stack >
            <div ref={bottomRef}></div>
        </Container >
    )
}
