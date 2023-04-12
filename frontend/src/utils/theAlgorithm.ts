import { StatusType, weightsType } from "../types";

export default function sortFeed(
    array: StatusType[],
    reblogs: any,
    core_servers: any,
    favs: any,
    seenFeed: StatusType[],
    userReblogWeight: number,
    userFavWeight: number,
    topPostWeight: number,
    frequencyWeight: number,
    timePenalty: number,
    activePenalty: number,
): StatusType[] {
    //how often a post is in the feed
    var weights: { [key: string]: weightsType } = {};
    var accounts: { [key: string]: number } = {};

    //Apply Weights
    array.forEach((item) => {
        if (item.reblog) item.uri = item.reblog.uri;
        if (!(item.uri in weights)) weights[item.uri] = {
            "userReblogWeight": 0,
            "userFavWeight": 0,
            "topPostWeight": 0,
            "frequencyWeight": 0,
            "similarity": 0,
        }
        const weight: weightsType = {
            "userReblogWeight": (item.account.acct in reblogs) ? reblogs[item.account.acct] * userReblogWeight : 0,
            "userFavWeight": (item.account.acct in favs) ? favs[item.account.acct] * userFavWeight : 0,
            "topPostWeight": item.topPost ? topPostWeight : 0,
            "frequencyWeight": frequencyWeight,
        }
        console.log(weight)
        for (let key in weight) {
            if (weights[item.uri].hasOwnProperty(key)) {
                weights[item.uri][key] += weight[key]
            }
        }
        console.log(weights[item.uri])
    });

    //Remove already seen content - Currently Not Implemented
    const seenUris = [...seenFeed].map((item) => item.uri);

    //Remove unwanted content
    array = array
        .filter(item => item != undefined)
        .filter(item => item.inReplyToId === null)
        .filter((item: StatusType) => item.content.includes("RT @") === false)
        .filter((item: StatusType) => !item.reblogged)

    //Remove duplicates
    array = [...new Map(array.map(item => [item["uri"], item])).values()];

    //Apply Weights and sort
    const sortedArray = array.map((item) => {
        console.log(weights[item.uri])
        item.weights = weights[item.uri]
        item.value = Object.values(weights[item.uri]).reduce((accumulator, currentValue) => accumulator + currentValue, 0);
        return item;
    }).filter((item) => item.value > 0)
        .sort(function (a, b) {
            return b.value - a.value
        })

    //Apply Discounts
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

    //Finalize Feed for display
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
    console.log(finalArray)
    return finalArray
}