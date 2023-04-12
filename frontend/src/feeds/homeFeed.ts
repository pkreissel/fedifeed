export default async function getHomeFeed(masto: any) {
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