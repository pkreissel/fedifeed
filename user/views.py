from http import client
from django.shortcuts import render, redirect
import requests
from django.http import JsonResponse, HttpResponse
from mastodon import Mastodon
from .models import MastodonUser, MastodonServer
from django.contrib.auth.models import User
from django.contrib.auth import login as auth_login, logout as auth_logout
from django.contrib.auth.decorators import login_required
from django.conf import settings
# Create your views here.

DEFAULT_SCOPES = ["read:favourites", "read:follows", "read:search", "read:blocks",
                  "read:accounts", "read:statuses", "write:favourites", "write:statuses", "write:follows",
                  "read:lists", "write:lists", "read:filters", "read:blocks"
                  ]


def index(request):
    auth_url = None
    print(auth_url)
    if request.user.is_authenticated:
        token = request.user.mastodon.token
        server = request.user.mastodon.server.api_base_url
    else:
        token = ""
        server = ""
    return render(request, 'user/index.html', context={
        "auth_url": auth_url,
        "token": token,
        "server": server
    })


@login_required
def logout(request):
    api = Mastodon(
        access_token=request.user.mastodon.token,
        api_base_url=request.user.mastodon.server.api_base_url,
    )
    api.revoke_access_token()
    auth_logout(request)
    return redirect('/')


def login(request):
    code = request.GET.get('code')
    # Server Name from coookie
    print(code)
    server = request.session.get('server')
    server = MastodonServer.standardize_servername(server)
    print(server)
    mastoServer = MastodonServer.objects.get(api_base_url=server)
    api = Mastodon(
        client_id=mastoServer.client_id,
        client_secret=mastoServer.client_secret,
        api_base_url=mastoServer.api_base_url,
    )
    token = api.log_in(
        code=code,
        redirect_uri=settings.HOSTED_URL + "/login",
        scopes=DEFAULT_SCOPES
    )
    print(token)
    me = api.me()
    if User.objects.filter(username=me.url).count() > 0:
        user = User.objects.get(username=me.url)
    else:
        password = User.objects.make_random_password()
        user = User.objects.create_user(me.url, password=password)
    mastodonuser, created = MastodonUser.objects.get_or_create(
        user=user,
        userId=me.id,
        username=me.username,
        server=mastoServer
    )
    mastodonuser.token = token
    mastodonuser.save()
    auth_login(request, user)
    return redirect('/')


def register(request):
    from urllib.parse import urlparse
    server = request.GET.get('server')
    server = MastodonServer.standardize_servername(server)
    mastoServer, created = MastodonServer.objects.get_or_create(
        api_base_url=server)
    request.session['server'] = server
    if created or settings.DEBUG:
        client_id, client_secret = Mastodon.create_app(
            api_base_url=server,
            redirect_uris=settings.HOSTED_URL + "/login",
            scopes=DEFAULT_SCOPES,
            client_name="SmartFeed",
        )
        mastoServer.client_id = client_id
        mastoServer.client_secret = client_secret
        print(client_id)
        print(client_secret)
        mastoServer.save()
    print(mastoServer.api_base_url)
    print(mastoServer.client_id)
    print(mastoServer.client_secret)
    api = Mastodon(
        client_id=mastoServer.client_id,
        client_secret=mastoServer.client_secret,
        api_base_url=mastoServer.api_base_url,
    )
    auth_url = api.auth_request_url(
        client_id=mastoServer.client_id,
        redirect_uris=settings.HOSTED_URL + "/login",
        scopes=DEFAULT_SCOPES
    )
    print(auth_url)
    return redirect(auth_url)


@login_required
def reblogs(request):
    """Fetch Users that are reblogged the most

    Args:
        request (request): request

    Returns:
        JSONResponse: Most reblogged users as a json-dict
    """
    import pandas as pd
    from django.core.cache import cache
    if len(cache.get(f'reblogs{request.user.id}', [])) > 0:
        frequent = cache.get(f'reblogs{request.user.id}')
    else:
        api = Mastodon(
            access_token=request.user.mastodon.token,
            api_base_url=request.user.mastodon.server.api_base_url,
        )
        id = api.me().id
        page = api.account_statuses(
            id, exclude_replies=True, exclude_reblogs=False)
        results = page
        for _ in range(3):
            page = api.fetch_next(page)
            if page is None:
                break
            results.extend(page)
        if len(results) == 0:
            return JsonResponse({})
        reblogs = [results.reblog for results in results if results.reblog]
        frequent = pd.json_normalize(reblogs).value_counts('account.acct')
        cache.set(f'reblogs{request.user.id}', frequent, 60*60*24)
    return JsonResponse(frequent.to_dict())


@login_required
def favorites(request):
    """Fetch Users that are favorited the most

    Args:
        request (request): The request

    Returns:
        JSONResponse: Most favorited users as a json-dict
    """
    import pandas as pd
    from django.core.cache import cache
    if len(cache.get(f'favs{request.user.id}', [])) > 0:
        frequent = cache.get(f'favs{request.user.id}')
    else:
        api = Mastodon(
            access_token=request.user.mastodon.token,
            api_base_url=request.user.mastodon.server.api_base_url,
        )
        id = api.me().id
        page = api.favourites()
        results = page
        for _ in range(3):
            page = api.fetch_next(page)
            if page is None:
                break
            results.extend(page)
        if len(results) == 0:
            return JsonResponse({})
        frequent = pd.json_normalize(results).value_counts('account.acct')
        cache.set(f'favs{request.user.id}', frequent, 60*60*24)
    return JsonResponse(frequent.to_dict())


@login_required
def core_accounts(request):
    api = Mastodon(
        access_token=request.user.mastodon.token,
        api_base_url=request.user.mastodon.server.api_base_url,
    )


@login_required
def core_servers(request):
    import pandas as pd
    from django.core.cache import cache
    if len(cache.get(f'core_servers{request.user.id}', [])) > 0:
        frequent_server = cache.get(f'core_servers{request.user.id}')
    else:
        api = Mastodon(
            access_token=request.user.mastodon.token,
            api_base_url=request.user.mastodon.server.api_base_url,
        )
        if not request.user.mastodon.userId:
            me = api.me()
            mastodonuser = request.user.mastodon
            mastodonuser.userId = me.id
            mastodonuser.save()

        followers = api.fetch_remaining(api.account_following(
            request.user.mastodon.userId, limit=500))
        frequent = pd.json_normalize(followers)
        server = frequent['url'].str.split('@').str[0]
        frequent_server = server.value_counts()[:5].to_dict()
        cache.set(f'core_servers{request.user.id}', frequent_server, 60*60*24)
    return JsonResponse(frequent_server)
