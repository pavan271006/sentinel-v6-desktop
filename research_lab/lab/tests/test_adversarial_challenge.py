import time
import socket
import concurrent.futures
import pytest
from fastapi.testclient import TestClient
from lab.ground_truth.app import create_ground_truth_app
from lab.ground_truth.auth import create_unsigned_none_token
from lab.fixed_controls.app import create_fixed_controls_app
from lab.registry import get_registry


@u��ѕ�й�����ɔ)������}�����Р��(���������ɕ�ѕ}�ɽչ�}���ѡ}������}��Ѡ�鵕����舤(����ɕ��ɸ�Q�������С����(()��ѕ�й�����ɔ)������}�����Р��(���������ɕ�ѕ}��ᕑ}����ɽ��}������}��Ѡ�鵕����舤(����ɕ��ɸ�Q�������С����(()�������}ѽ�����������Q�������а��͕ɹ������Ȁ􀉅�����������ݽɐ���Ȁ�����ݽɐ��̈���������(����ɕ���􁍱���й���Р�������Ľ��Ѡ����������ͽ����͕ɹ������͕ɹ����������ݽɐ������ݽɑ�(������͕�Ёɕ����х���}��������������1�������������ɕ���ѕ���(����ɕ��ɸ�ɕ����ͽ���l�������}ѽ����
