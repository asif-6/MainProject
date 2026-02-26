import sys
import pymysql
pymysql.version_info = (2, 2, 1, "final", 0)
pymysql.install_as_MySQLdb()
sys.modules['MySQLdb'] = pymysql


# Reminder: for API logins accessed without session CSRF cookies,
# decorate the login view with @csrf_exempt (or ensure the client sends the CSRF token).