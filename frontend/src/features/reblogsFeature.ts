export default async function reblogsFeature() {
    const res = await fetch("/reblogs")
    if (!res.ok) {
        return { errors: res }
    }
    const data = await res.json();
    return data["reblogs"]
}