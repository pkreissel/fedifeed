export default async function coreServerFeature() {
    const res = await fetch("/core_servers")
    if (!res.ok) {
        return { errors: res }
    }
    const data = await res.json();
    return data
}