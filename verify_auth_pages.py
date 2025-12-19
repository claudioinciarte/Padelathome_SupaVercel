from playwright.sync_api import sync_playwright

def verify_auth_pages():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # 1. Login Page
        print("Verifying Login Page...")
        page.goto("http://localhost:8000/login.html")
        page.screenshot(path="login.png")

        # 2. Register Page
        print("Verifying Register Page...")
        page.goto("http://localhost:8000/register.html")
        page.screenshot(path="register.png")

        # 3. Reset Password Page
        print("Verifying Reset Password Page...")
        page.goto("http://localhost:8000/reset-password.html")
        page.screenshot(path="reset_password.png")

        # 4. Confirm Booking Page
        print("Verifying Confirm Booking Page...")
        page.goto("http://localhost:8000/confirm-booking.html")
        page.screenshot(path="confirm_booking.png")

        browser.close()

if __name__ == "__main__":
    verify_auth_pages()
