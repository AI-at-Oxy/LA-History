import pytest
from app import create_app


@pytest.fixture(scope='session')
def app():
    return create_app('testing')


@pytest.fixture
def client(app):
    with app.test_client() as c:
        yield c
