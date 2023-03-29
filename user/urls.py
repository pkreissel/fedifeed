from django.urls import path
from .views import index, login, reblogs, core_servers, register, logout, favorites
urlpatterns = [
    path('', index),
    path("login", login),
    path("logout", logout),
    path("register", register),
    path("reblogs", reblogs, name="reblogs"),
    path("favorites", favorites, name="favorites"),
    path("core_servers", core_servers, name="core_servers")
]
