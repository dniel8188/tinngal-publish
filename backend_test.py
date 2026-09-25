"""
Comprehensive backend API validation for Anyar wedding gallery.
Tests all public and admin endpoints as specified in the review request.
"""
import httpx
import uuid

BASE_URL = "http://localhost:8001/api"
ADMIN_PIN = "123456"  # from backend/.env


def test_1_public_endpoints():
    """Test 1: Public endpoints - GET /api/clients, GET /api/clients/{id}, GET /api/settings"""
    print("\n=== TEST 1: Public Endpoints ===")
    
    with httpx.Client(base_url=BASE_URL, timeout=30.0) as client:
        # Test GET /api/clients
        print("\n1.1 Testing GET /api/clients...")
        r = client.get("/clients")
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        clients = r.json()
        assert isinstance(clients, list), f"Expected list, got {type(clients)}"
        assert len(clients) == 6, f"Expected 6 clients, got {len(clients)}"
        
        # Verify each client has required fields
        for cl in clients:
            assert "id" in cl, f"Client missing 'id': {cl}"
            assert "name" in cl, f"Client missing 'name': {cl}"
            assert "photo_count" in cl, f"Client missing 'photo_count': {cl}"
        
        print(f"✓ GET /api/clients returned {len(clients)} clients with required fields")
        
        # Test GET /api/clients/{id}
        print("\n1.2 Testing GET /api/clients/{id}...")
        client_id = clients[0]["id"]
        r = client.get(f"/clients/{client_id}")
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        detail = r.json()
        assert detail["id"] == client_id, f"ID mismatch: {detail['id']} != {client_id}"
        assert "photos" in detail, f"Client detail missing 'photos': {detail.keys()}"
        assert isinstance(detail["photos"], list), f"Photos should be a list, got {type(detail['photos'])}"
        print(f"✓ GET /api/clients/{client_id} returned client detail with {len(detail['photos'])} photos")
        
        # Test GET /api/settings
        print("\n1.3 Testing GET /api/settings...")
        r = client.get("/settings")
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        settings = r.json()
        assert "brand_name" in settings, f"Settings missing 'brand_name': {settings.keys()}"
        assert settings["brand_name"] == "Arsa Wedding Gallery", \
            f"Expected 'Arsa Wedding Gallery', got '{settings['brand_name']}'"
        print(f"✓ GET /api/settings returned brand_name = '{settings['brand_name']}'")
    
    print("\n✅ TEST 1 PASSED: All public endpoints working correctly")


def test_2_admin_auth_and_gating():
    """Test 2: Admin auth + gating - login, session cookie, protected endpoints"""
    print("\n=== TEST 2: Admin Auth & Gating ===")
    
    # Test 2.1: GET /api/admin/clients WITHOUT session -> 401
    print("\n2.1 Testing GET /api/admin/clients without session...")
    with httpx.Client(base_url=BASE_URL, timeout=30.0) as client:
        r = client.get("/admin/clients")
        assert r.status_code == 401, f"Expected 401, got {r.status_code}: {r.text}"
        print(f"✓ GET /api/admin/clients without session returned 401")
    
    # Test 2.2: POST /api/admin/login with wrong PIN -> 401
    print("\n2.2 Testing POST /api/admin/login with wrong PIN...")
    with httpx.Client(base_url=BASE_URL, timeout=30.0) as client:
        r = client.post("/admin/login", json={"pin": "000000"})
        assert r.status_code == 401, f"Expected 401, got {r.status_code}: {r.text}"
        print(f"✓ POST /api/admin/login with wrong PIN returned 401")
    
    # Test 2.3: POST /api/admin/login with correct PIN -> 200 and sets cookie
    print("\n2.3 Testing POST /api/admin/login with correct PIN...")
    with httpx.Client(base_url=BASE_URL, timeout=30.0) as client:
        r = client.post("/admin/login", json={"pin": ADMIN_PIN})
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        assert "admin_session" in r.cookies, f"Expected 'admin_session' cookie, got {r.cookies.keys()}"
        print(f"✓ POST /api/admin/login with correct PIN returned 200 and set admin_session cookie")
        
        # Test 2.4: GET /api/admin/me with cookie -> authenticated true
        print("\n2.4 Testing GET /api/admin/me with cookie...")
        r = client.get("/admin/me")
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        me = r.json()
        assert "authenticated" in me, f"Response missing 'authenticated': {me}"
        assert me["authenticated"] is True, f"Expected authenticated=true, got {me['authenticated']}"
        print(f"✓ GET /api/admin/me returned authenticated=true")
        
        # Test 2.5: GET /api/admin/clients with cookie -> 200
        print("\n2.5 Testing GET /api/admin/clients with cookie...")
        r = client.get("/admin/clients")
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        admin_clients = r.json()
        assert isinstance(admin_clients, list), f"Expected list, got {type(admin_clients)}"
        print(f"✓ GET /api/admin/clients with cookie returned 200 with {len(admin_clients)} clients")
    
    print("\n✅ TEST 2 PASSED: Admin auth and gating working correctly")


def test_3_admin_client_crud():
    """Test 3: Admin client CRUD with cookie"""
    print("\n=== TEST 3: Admin Client CRUD ===")
    
    # Login and get admin session
    with httpx.Client(base_url=BASE_URL, timeout=30.0) as client:
        r = client.post("/admin/login", json={"pin": ADMIN_PIN})
        assert r.status_code == 200, f"Login failed: {r.status_code}: {r.text}"
        
        # Test 3.1: POST /api/admin/clients - create new client
        print("\n3.1 Testing POST /api/admin/clients (create)...")
        test_name = f"Test Couple {uuid.uuid4().hex[:8]}"
        r = client.post("/admin/clients", json={"name": test_name})
        assert r.status_code in (200, 201), f"Expected 200/201, got {r.status_code}: {r.text}"
        created = r.json()
        assert "id" in created, f"Created client missing 'id': {created}"
        client_id = created["id"]
        assert created["name"] == test_name, f"Name mismatch: {created['name']} != {test_name}"
        print(f"✓ POST /api/admin/clients created client with id={client_id}")
        
        try:
            # Test 3.2: PUT /api/admin/clients/{id} - update venue
            print("\n3.2 Testing PUT /api/admin/clients/{id} (update)...")
            r = client.put(f"/admin/clients/{client_id}", json={"venue": "Test Venue"})
            assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
            updated = r.json()
            assert updated["venue"] == "Test Venue", f"Venue not updated: {updated['venue']}"
            print(f"✓ PUT /api/admin/clients/{client_id} updated venue successfully")
            
            # Test 3.3: POST /api/admin/clients with invalid Drive link -> 400
            print("\n3.3 Testing POST /api/admin/clients with invalid Drive link...")
            bad_name = f"Bad Client {uuid.uuid4().hex[:8]}"
            r = client.post("/admin/clients", json={
                "name": bad_name,
                "drive_folder": "not-a-valid-link"
            })
            assert r.status_code == 400, f"Expected 400, got {r.status_code}: {r.text}"
            print(f"✓ POST /api/admin/clients with invalid Drive link returned 400")
            
            # Verify bad client was not created
            r = client.get("/clients")
            assert r.status_code == 200
            clients = r.json()
            assert not any(c["name"] == bad_name for c in clients), \
                f"Bad client '{bad_name}' should not have been created"
            print(f"✓ Verified bad client was not created")
            
            # Test 3.4: DELETE /api/admin/clients/{id}
            print("\n3.4 Testing DELETE /api/admin/clients/{id}...")
            r = client.delete(f"/admin/clients/{client_id}")
            assert r.status_code in (200, 204), f"Expected 200/204, got {r.status_code}: {r.text}"
            print(f"✓ DELETE /api/admin/clients/{client_id} returned {r.status_code}")
            
            # Verify client is gone
            r = client.get(f"/clients/{client_id}")
            assert r.status_code == 404, f"Expected 404, got {r.status_code}: client should be deleted"
            print(f"✓ Verified client {client_id} is deleted (GET returns 404)")
            
        except Exception as e:
            # Cleanup on error
            print(f"\n⚠ Error during test, attempting cleanup...")
            try:
                client.delete(f"/admin/clients/{client_id}")
            except:
                pass
            raise e
    
    print("\n✅ TEST 3 PASSED: Admin client CRUD working correctly")


def test_4_settings_admin():
    """Test 4: Settings admin - GET, PUT, reset"""
    print("\n=== TEST 4: Settings Admin ===")
    
    # Login and get admin session
    with httpx.Client(base_url=BASE_URL, timeout=30.0) as client:
        r = client.post("/admin/login", json={"pin": ADMIN_PIN})
        assert r.status_code == 200, f"Login failed: {r.status_code}: {r.text}"
        
        # Test 4.1: GET /api/admin/settings
        print("\n4.1 Testing GET /api/admin/settings...")
        r = client.get("/admin/settings")
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        settings = r.json()
        assert "brand_name" in settings, f"Settings missing 'brand_name': {settings.keys()}"
        original_brand = settings["brand_name"]
        print(f"✓ GET /api/admin/settings returned settings with brand_name='{original_brand}'")
        
        # Test 4.2: PUT /api/admin/settings - change brand_name
        print("\n4.2 Testing PUT /api/admin/settings (update brand_name)...")
        new_brand = f"Test Brand {uuid.uuid4().hex[:8]}"
        settings["brand_name"] = new_brand
        r = client.put("/admin/settings", json=settings)
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        updated = r.json()
        assert updated["brand_name"] == new_brand, \
            f"Brand name not updated: {updated['brand_name']} != {new_brand}"
        print(f"✓ PUT /api/admin/settings updated brand_name to '{new_brand}'")
        
        # Verify change via public endpoint
        print("\n4.3 Verifying change via GET /api/settings...")
        r = client.get("/settings")
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        public_settings = r.json()
        assert public_settings["brand_name"] == new_brand, \
            f"Public settings not updated: {public_settings['brand_name']} != {new_brand}"
        print(f"✓ GET /api/settings reflects the change: brand_name='{new_brand}'")
        
        # Test 4.4: POST /api/admin/settings/reset - restore defaults
        print("\n4.4 Testing POST /api/admin/settings/reset...")
        r = client.post("/admin/settings/reset")
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        reset_settings = r.json()
        assert reset_settings["brand_name"] == "Arsa Wedding Gallery", \
            f"Expected 'Arsa Wedding Gallery', got '{reset_settings['brand_name']}'"
        print(f"✓ POST /api/admin/settings/reset restored brand_name to 'Arsa Wedding Gallery'")
        
        # Verify reset via public endpoint
        print("\n4.5 Verifying reset via GET /api/settings...")
        r = client.get("/settings")
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        final_settings = r.json()
        assert final_settings["brand_name"] == "Arsa Wedding Gallery", \
            f"Public settings not reset: {final_settings['brand_name']}"
        print(f"✓ GET /api/settings confirms reset: brand_name='Arsa Wedding Gallery'")
    
    print("\n✅ TEST 4 PASSED: Settings admin working correctly")


def run_all_tests():
    """Run all backend API tests"""
    print("\n" + "="*70)
    print("ANYAR WEDDING GALLERY - BACKEND API VALIDATION")
    print("="*70)
    
    try:
        test_1_public_endpoints()
        test_2_admin_auth_and_gating()
        test_3_admin_client_crud()
        test_4_settings_admin()
        
        print("\n" + "="*70)
        print("✅ ALL TESTS PASSED - Backend API validation complete!")
        print("="*70)
        return True
        
    except AssertionError as e:
        print(f"\n❌ TEST FAILED: {e}")
        return False
    except Exception as e:
        print(f"\n❌ UNEXPECTED ERROR: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    success = run_all_tests()
    exit(0 if success else 1)
