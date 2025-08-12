import os
import binascii
import sys


def main(path: str):
    print('path:', path)
    print('exists:', os.path.exists(path))
    if not os.path.exists(path):
        return
    print('size:', os.path.getsize(path))
    with open(path, 'rb') as f:
        head = f.read(64)
    print('head hex:', binascii.hexlify(head))
    ascii_head = ''.join(chr(b) if 32 <= b < 127 else '.' for b in head)
    print('head ascii:', ascii_head)


if __name__ == '__main__':
    p = sys.argv[1] if len(sys.argv) > 1 else os.path.join('model', 'spam_model.pkl')
    main(p)
