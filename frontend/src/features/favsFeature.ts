export default async function favsFeature() {
    const res = await fetch("/favorites")
    if (!res.ok) {
        return { errors: res }
    }
    const data = await res.json();
    return data
}