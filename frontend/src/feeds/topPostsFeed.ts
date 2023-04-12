import { SerializerNativeImpl } from "masto";

export default async function getTopPostFeed(core_servers: any) {
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