# fedifeed
Display Mastodon Posts in a curated feed with an user-customisable algorithm

# Usage
Example is hosted here:
https://fedifeed.herokuapp.com

Be aware this is a very early alpha, so try at your own risk

Steps:
1. Put your Mastodon Instance Url in the field in the format "https://example.social"
2. Login with Mastodon
3. Wait a few seconds for the feed to load (first time takes longer)
4. Change Feed Algorithm and enjoy


# Development
Project is based on Django and React Frameworks. See their docs for further info. 
To start the backend server you need 

```
pip install -r requirements.txt
```
Then set some env vars:
```
FIELD_ENCRYPTION_KEY= // generate this with python manage.py generate_encryption_key
DATABASE_URL=Postgresql Database URL
SECRET_KEY=Some Secret
HOSTED_URL=http://127.0.0.1:8000/ (for local dev)
DEBUG=True
```
Run the server:
```
python manage.py makemigrations
python manage.py migrate
python manage.py runserver 
```
Only the last command is required every time.

To start the frontend dev server:
```
cd frontend
npx webpack --config webpack.config.js --watch
```

# Todos:
- [ ] Improve CI/CD
- [ ] Add Tests
- [ ] Add more Documentation
- [x] Add storage for feed Settings
- [x] Add most liked users to weights
- [ ] Add option to choose which Instances to pull the top posts from
- [ ] More description for weights
- [x] Add Logout Button and invalidate token 
- [ ] Better UI, Support for Polls, Videos, Images, etc.
- [ ] Working Links back into the traditional Mastodon Interface
- [x] Retweet, Like etc. Buttons
- [ ] Profile View to delete profile etc. 
- [ ] Feed should cache posts and only load new ones
- [ ] Add more features for algorithm, e.g. include posts from suggested users, prioritise recent follows etc.
- [ ] Add local machine learning in the browser to tweak the features automatically


