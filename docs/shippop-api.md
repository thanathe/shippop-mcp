# SHIPPOP Domestic API — condensed reference

Condensed from the official Postman collection (https://documenter.getpostman.com/view/10021496/Tzz8qwkE) on 2026-09-02. Only the endpoints this MCP uses are expanded; the rest are listed for orientation. Always defer to the official docs.

- Production base URL: `https://mkpservice.shippop.com/`
- Dev base URL: `https://mkpservice.shippop.dev/`
- Auth: `api_key` in the request body (JSON or form). `/tracking/` needs no key.
- Envelope: `{ "status": true|false, "code"?, "message"?, ... }`. Lists come back as arrays **or** objects keyed `"0","1",…`.


## Domestic APIs - สำหรับขนส่งภายในประเทศ

### Getting Started- เริ่มต้นการใช้งาน

Environment 
 Base URL 
 Production 
 https://mkpservice.shippop.com/ 
 Dev 
 https://mkpservice.shippop.dev/ 
 API FLOW 
 GET PRICE Checking price of available couriers
 BOOKING ORDER Booking order by selecting the available courier, then get the purchase ID using for confirm process and SHIPPOP tracking code using for tracking the order.
 CONFIRM Confirm purchase will send the data to the courier then cannot edit all the information or cancel the purchase.
 LABEL For SHIPPOP label template (or using your own template)

#### Courier Code -  รายการขนส่ง

ชื่อขนส่ง (courier name) 
 รหัสขนส่ง ( courier code ) 
 Note 
 SHIPPOP Fruit 
 SHF 
 ไปรษณีย์ไทย EMS 
 EMST 
 ไปรษณีย์ไทย eCo-post 
 ECP 
 DHL 
 DHL 
 Flash Express 
 FLE 
 Flash Express Bulky 
 FLEB 
 ส่งพัสดุขนาดใหญ่ 
 Flash Express Fruit 
 FLEF 
 ส่งผักและผลไม้ 
 Flash Express Dropoff 
 FLEDS 
 เฉพาะผู้มีหน้าร้านสาขา 
(Dropoff Offline) 
 Best Express 
 BEST 
 Aramex 
 ARM 
 KEX Exclusive 
 KRYX 
 KEX Offline 
 KRYS 
 เฉพาะผู้มีหน้าร้านสาขา 
(Dropoff Offline) 
 KEX Dropoff 
 KRYDS 
 เฉพาะผู้มีหน้าร้านสาขา 
(Dropoff Offline) 
 J&T Express (Pickup) 
 JNTP 
 เฉพาะผู้มีหน้าร้านสาขา 
(Dropoff Offline) 
 J&T Express (Dropoff) 
 JNTD 
 เฉพาะผู้มีหน้าร้านสาขา 
(Dropoff Offline) 
 Lazada Dropoff 
 LZDS 
 เฉพาะผู้มีหน้าร้านสาขา 
(Dropoff Offline) 
 Makesend 
 MSE 
 Makesend Chilled 
 MSEC 
 ส่งของเย็น 
 Makesend Frozen 
 MSEF 
 ส่งของแช่แข็ง 
 SPX Express (Shopee) 
 SPX 
 Lalamove 
 LLM 
 ขนส่ง Ondemand 
 Skootar 
 SKT 
 ขนส่ง Ondemand

#### Object - รูปแบบข้อมูล

#### Address - ข้อมูลที่อยู่

An object stores all the Address including province, state, district, postcode and phone number.
 เป็น Object เอาไว้เก็บที่อยู่ เพื่อบอกรายละเอียดของจังหวัด อำเภอ รหัสไปรษณีย์ เบอร์โทรเป็นต้น
 Name ( Parameter ) 
 Optional 
 Type 
 Description 
 province 
 String 
 Store province data 
 state 
 String 
 Store state data 
 district 
 String 
 Store district data 
 postcode 
 String 
 Store postcode data 
 address 
 String 
 Full address 
 name 
 String 
 Name of contact person of this address 
 tel 
 String 
 Phone number of contact person of this address 
 email 
 yes 
 String 
 Email of contact person of this address 
 lat 
 yes 
 String 
 On-demand 
 lng 
 yes 
 String 
 On-demand

#### Parcel - ข้อมูลพัสดุ

An object stores the Parcel data including weight, size, width, length, and height
 Name ( Parameter ) 
 Optional 
 Type 
 Description 
 parcel_size 
 yes 
 Int 
 SHIPPOP parcel code size 
 name 
 String 
 Parcel name 
 weight 
 Float 
 Parcel weight and the unit is gram. (Approximately calculate by : (width*length*height) / 5000 ) 
 width 
 Float 
 Parcel width and the unit is centimetre 
 length 
 Float 
 Parcel length and the unit is centimetre 
 height 
 Float 
 Parcel height and the unit is centimetre 
 default 
 Int 
 Is this parcel size is default 
0 : not default 
1 : a parcel 
 use_box_calculation 
 Auto box calculation 
 Boolean 
 true 
false (default)

#### PRODUCT - ข้อมูลสินค้า

An object stores the information of product inside including product price, product amount and product weight
 *Required for COD Shipment
 Name ( Parameter ) 
 Optional 
 Type 
 Description 
 product_code 
 String 
 Store product code 
 name 
 String 
 Store product name in the parcel 
 category 
 String 
 detail 
 yes 
 String 
 Store product detail in the parcel 
 price 
 Float 
 Store product price in the parcel 
 amount 
 Integer 
 Store amount of the product in the parcel 
 weight 
 Float 
 Store product weight in gram 
 size 
 yes 
 color 
 yes

#### POST OFFICE​ - ข้อมูลสาขาไปรษณีย์

#### Label - ข้อมูลใบปะหน้า

Parameter 
 Optional 
 Type 
 Description 
 replaceOrigin 
 yes 
 Address Object 
 Replace origin detail on label in case of origin detail is different from Booking API 
 orderDate 
 yes 
 String 
 Order Date (e.g. 2023-01-01) 
 printDate 
 yes 
 String 
 Print Date (e.g. 2023-01-01)

#### Error Code - คำอธิบาย Error code

Detail meaning of error code 
 Name ( Parameter ) 
 Optional 
 Type 
 Description 
 SERVICE_MAINTENANCE 
 string 
 Service maintenance 
 ERR_MAINTENANCE 
 string 
 System Maintenance 
 ERR_ORIGIN 
 string 
 Invalid Origin area 
 ERR_DEST 
 string 
 Invalid Destination area 
 ERR_DEFAULT 
 string 
 Error msg 
 ERR_REALTIME_CHECKPRICE 
 string 
 Courier not calculate 
 ERR_REVERSE_GEOCODE_FAILURE 
 string 
 Reverse geocode failure 
 ERR_COD_AMOUNT_EXCEED 
 string 
 COD Amount Exceed 
 ERR_NOT_SUPPORT_COD 
 string 
 Not Support COD 
 NOT_SUPPORT_COD 
 string 
 Courier service not support cod 
 INVALID_WEIGHT 
 string 
 Invalid weight 
 ERR_OVER_WEIGHT 
 string 
 Over weight 
 ERR_MIN_ORDER_10 
 string 
 Minimum 10 order 
 ERR_OUT_OF_AREA 
 string 
 Service Unavailable 
 ERR_SIZE 
 string 
 Invalid size 
 ERR_OVER_SIZE 
 string 
 Over size 
 ERR_MIN_ORDER_{x} 
 string 
 Minimum X order Ex. ERR_MIN_ORDER_3 = Booking Minimum 3 Shipments 
 DAY_OFF 
 string 
 Holiday 
 ERR_POSTCODE 
 string 
 รหัสไปรษณีย์ดังกล่าว ไม่เปิดให้ใช้บริการ 
 ERR_LAT_LNG 
 string 
 Invalid lat , lng data 
 ERR_SIZE_{x} 
 string 
 Parcel size (w+l+h) not to exceed xcmEx. ERR_SIZE_150 = size not exceed 150cm

#### Address - ข้อมูลที่อยู่

https://docs.google.com/spreadsheets/d/111TbrsRJVhyBmOrhOZVln68lfmz8DTmZDYwzZMARozI/edit?gid=224070780#gid=224070780

### 1. Courier Info - ข้อมูลเงื่อนไขขนส่ง

`GET https://api.shippop.dev/v1/couriers/api/courier/information/:language/:courier_code` — 1.1 Information (single result)

`GET https://api.shippop.dev/v1/couriers/api/courier/information/:language` — 1.2 Information (all results)

`GET https://api.shippop.dev/v1/couriers/api/courier/image/:courier_code` — 1.3 Logo (single result)

### 2. Checkprice - ตรวจสอบราคา

#### 2.1 Check Price - ตรวจสอบราคาค่าขนส่ง

Name ( Parameter ) 
 Optional 
 Type 
 Description 
 api_key 
 String 
 Api key 
 data[{key}] 
 Array Object 
 GET PRICE DATA OBJECT 
(as table below) 
 GET PRICE DATA OBJECT 
 Name ( Parameter ) 
 Optional 
 Type 
 Description 
 from 
 Object 
 ADDRESS OBJECT 
 to 
 Object 
 ADDRESS OBJECT 
 parcel 
 Object 
 PARCEL OBJECT 
 courier_code 
 yes 
 String 
 Select courier 
 cod_amount 
 yes 
 Int 
 cod amount 
 showall 
 yes 
 Integer 
 0 (default) : show only available couriers 
1 : show all couriers on hands 
 RESPONSE GET PRICE 
 SHIPPOP response if success
 Name ( Parameter ) 
 Optional 
 Type 
 Description 
 status 
 Boolean 
 True : Success 
False : Fail with error code 
 code 
 yes 
 Integer 
 400 : Incomplete request 
 data 
 Array 
 Array of data request 
 data[{key}] 
 Array Object 
 Post data object and key 
 Data[{key}] [{courier_code}] 
 Array Object 
 Post data Object courier_code By COURIER DATA OBJECT 
 Courier Data Object
 Name ( Parameter ) 
 Optional 
 Type 
 Description 
 price 
 Integer 
 Total price 
- included all surcharges 
- remote/travel/island/fuel 
 estimate_time 
 String 
 Condition Delivery time 
 available 
 Boolean 
 True : courier_code available 
False : unavailable 
 courier_code 
 String 
 courier code 
 error_code 
 String 
 Get price error code table 
 courier_name 
 String 
 courier name 
 remark 
 yes 
 String 
 Remark response not shipping / Condition Shipment 
 notice 
 yes 
 String 
 Notice 
 price_fuel_surcharge 
 yes 
 Integer 
 Fuel surcharge 
 price_remote_area 
 yes 
 Integer 
 Extra charge 
 price_travel_area 
 yes 
 Integer 
 Travel surcharge 
 price_island_area 
 yes 
 Integer 
 Island surcharge 
 price_cod 
 default = 0 
 Float 
 COD charge 
 price_cod_vat 
 default = 0 
 Float 
 Vat of COD Charge 
 price_zone 
 yes 
 String 
 zone for price calculation

**`POST {{BASE_URL}}/pricelist/` — 2.1.1 Check Price - ตรวจสอบราคาค่าขนส่งทั่วไป**

Request example:
```json
{
    "api_key": "{{YOUR_API_KEY}}",
    "data": {
        "0": {
            "from": {
                "name": "ผู้ส่ง ต้นทาง 1",
                "address": "บริษัท​ ชิปป๊อป​ จำกัด 1​",
                "district": "ถนนพญาไท",
                "state": "ราชเทวี",
                "province": "กรุงเทพมหานคร",
                "postcode": "10400",
                "tel": "0123456789",
                "lat": "13.7615902",
                "lng": "100.534519"
            },
            "to": {
                "name": "ผู้รับ ปลายทาง 1",
                "address": "บริษัท​ ชิปป๊อป​ จำกัด​ 2",
                "district": "สีลม",
                "state": "บางรัก",
                "province": "กรุงเทพมหานคร",
                "postcode": "10500",
                "tel": "0123456789",
                "lat": "13.7615902",
                "lng": "100.534519"
            },
            "parcel": {
                "name": "สินค้าชิ้นที่ 1",
                "weight": 18000,
                "width": 30,
                "length": 100,
                "height": 30
            },
            "courier_code": "FLE",
            "showall": 1
        },
        "1": {
            "from": {
                "name": "ผู้ส่ง ต้นทาง 2",
                "address": "บริษัท​ ชิปป๊อป​ จำกัด 1​",
                "district": "ถนนพญาไท",
                "state": "ราชเทวี",
                "province": "กรุงเทพมหานคร",
                "postcode": "10400",
                "tel": "0123456789"
            },
            "to": {
                "name": "ผู้รับ ปลายทาง 2",
                "address": "บริษัท​ ชิปป๊อป​ จำกัด​ 2",
                "district": "สีลม",
                "state": "บางรัก",
                "province": "กรุงเทพมหานคร",
                "postcode": "10500",
                "tel": "0123456789"
   
```

Response example (Check Price - ตรวจสอบราคาค่าขนส่งทั่วไป):
```json
{
    "status": true,
    "data": {
        "0": {
            "FLE": {
                "estimate_time": "ภายใน 1 - 2 วัน",
                "courier_code": "FLE",
                "price": "238",
                "available": true,
                "remark": "optional",
                "err_code": "ERR_DEFAULT",
                "courier_name": "FlashExpress",
                "price_cod": 0,
                "price_cod_vat": 0
            }
        },
        "1": {
            "EMST": {
                "courier_code": "EMST",
                "price": "52",
                "estimate_time": "ภายใน 1 - 2 วัน",
                "available": true,
                "remark": "optional",
                "err_code": "ERR_DEFAULT",
                "courier_name": "EMS Thailand Post",
                "price_cod": 0,
                "price_cod_vat": 0
            }
        },
        "2": {
            "KRYS": {
                "courier_code": "KRYS",
                "price": "38",
                "estimate_time": "ภายใน 1 - 2 วัน",
                "available": true,
                "remark": "optional",
                "err_code": "ERR_DEFAULT",
                "price_fuel_surcharge": 2,
                "price_zone": "ZONE_2",
                "courier_name": "Kerry Shop",
                "price_cod": 0,
                "price_cod_vat": 0
            }
        }
    }
}
```

`POST {{BASE_URL}}/pricelist/` — 2.1.2 Check Price - ตรวจสอบราคาค่าขนส่งออนดีมาน (On Demand)

#### 2.2 Public Check Price - ตรวจสอบราคาค่าขนส่งมาตรฐานของทาง SHIPPOP

`POST {{BASE_URL}}/public/pricelist/` — 2.2.1 Public Check Price - ตรวจสอบราคาค่าขนส่งทั่วไป

### 3. Booking - สร้างรายการจัดส่ง

**`POST {{BASE_URL}}/booking/` — 3.1 BOOKING ORDER - สร้างรายการจัดส่ง**

Request Body 
 Name ( Parameter ) 
 Optional 
 Type 
 Description 
 api_key 
 String 
 Api key : Verify Marketplace 
 email 
 String 
 Email Address 
 data 
 Array 
 Data can post multiple order by Array 
 data[{key}] 
 Array Object 
 Ref : BOOKING DATA OBJECT 
 promo_code 
 yes 
 String 
 Coupon code 
 token 
 yes 
 String 
 Token is verified instead of email only for SHIPPOP B2C customers. 
 domain 
 yes 
 String 
 If sending a token, it must post the domain to confirm the domain setting in SHIPPOP B2C 
 force_confirm 
 yes 
 Interger 
 0 = must confirm (default) 
1 = auto confirm 
 BOOKING DATA OBJECT 
 Name ( Parameter ) 
 Optional 
 Type 
 Description 
 from 
 Object 
 Ref : Address Object 
 to 
 Object 
 Ref : Address Object 
 parcel 
 Object 
 Ref : Parcel Object 
 product[{key}] 
 Array Object 
 Ref : Product Object 
 courier_code 
 String 
 Courier code 
 remark 
 yes 
 String 
 Remark for this order 
 starttime 
 yes 
 Time 
 start time to pick up parcel ( Only skootar ) 
 finishtime 
 yes 
 Time 
 finish time to complete ( Only Skootar ) 
 cod_amount 
 yes 
 integer 
 COD amount 
 insurance_code 
 yes 
 String 
 Insurance code 
DHPY - Dhipaya Insurance (support all couries) 
THP - Thailand Post Insurance (support only Thailand Post shipment) 
 declared_value 
 yes 
 Integer 
 Declared insurance value 
 branch_id 
 yes 
 String 
 Kerry Offline required branch_id 
 pre_barcode 
 yes 
 String 
 Tracking Code (สำหรับขนส่งบ้างประเภท) 
 meta 
 yes 
 Object 
 ข้อมูล shipment เพิ่มเติมสำหรับ Reference 
 meta[ref_no_1] 
 yes 
 String 
 Reference1 
 meta[ref_no_2] 
 yes 
 String 
 Reference2 
 Request Body เพิ่มเติม (สำหรับลูกค้า PREPAID) 
 Name ( Parameter ) 
 Optional 
 Type 
 Description 
 url[success] 
 String 
 Redirect url after payment success 
 url[fail] 
 String 
 Redirect url after payment fail 
 RESPONSE BOOKING ORDER ( Case Payment Form = 0 ) : Not retuen form payment ,Must Confirm api 
 Response booking SHIPPOP after success
 Name ( Parameter ) 
 Optional 
 Type 
 Description 
 status 
 Boolean 
 True : Success False : fail 
 code 
 yes 
 Integer 
 Error code 404 On status false 
 data 
 Array 
 Data can post multiple order by Array 
 data[{key}] 
 Array Object 
 Ref : BOOKING RESPONSE OBJECT 
 purchase_id 
 Integer 
 Purchase Shippop 
 payment_url 
 yes 
 String 
 payment URL 
 total_price 
 Float 
 Total Price 
 total_cod_charge 
 Float 
 Total cod charge 
 BOOKING RESPONSE OBJECT 
 Name ( Parameter ) 
 Optional 
 Type 
 Description 
 price 
 Float 
 Price 
 from 
 Object 
 Ref : Address Object 
 to 
 Object 
 Ref : Address Object 
 parcel 
 Object 
 Ref : Parcel Object 
 courier_code 
 String 
 Courier code 
 status 
 Boolean 
 True : Booking Success 
False : Booking False 
 tracking_code 
 String 
 SHIPPOP CODE 
 courier_tracking_code 
 String 
 Courier tracking code 
 discount 
 Float 
 Discount 
 cod_amount 
 Integer 
 COD amount 
 cod_charge 
 Float 
 COD charge 
 cod_vat 
 Float 
 COD vat 
 price_fuel_surcharge 
 yes 
 Integ

Request example:
```json
{
    "api_key": "{{YOUR_API_KEY}}",
    "email": "test@shippop.com",
    "data": [
        {
            "from": {
				"name": "ผู้ส่ง นามสกุล (ทดสอบระบบไม่ต้องเข้ารับ)",
				"address": "1/1",
				"district": "แขวงห้วยขวาง",
				"state": "เขตห้วยขวาง",
				"province": "กรุงเทพ",
				"postcode": "10310",
				"tel": "0800000000"
			},
			"to": {
				"name": "ผู้รับ นามสกุล",
				"address": "2/2",
				"district": "สีลม",
				"state": "บางรัก",
				"province": "กรุงเทพ",
				"postcode": "10500",
				"tel": "0800000000"
			},
            "parcel": {
                "name": "-",
                "weight": 1,
                "width": 1,
                "length": 1,
                "height": 1
            },
            "courier_code": "EMST"
        }
    ]
}
```

Response example (รายการแนบข้อมูลสินค้า (Product)):
```json
{
    "status": true,
    "purchase_id": 452002,
    "total_price": 25,
    "total_cod_charge": 0,
    "total_cod_charge_vat": 0,
    "data": {
        "0": {
            "status": true,
            "tracking_code": "SP452045855",
            "courier_code": "EMST",
            "price": 25,
            "discount": 0,
            "from": {
                "district": "แขวงห้วยขวาง",
                "state": "เขตห้วยขวาง",
                "province": "กรุงเทพ",
                "postcode": "10310",
                "country": "Thailand",
                "address": "1/1",
                "name": "ผู้ส่ง นามสกุล (ทดสอบระบบไม่ต้องเข้ารับ)",
                "email": "test@shippop.com",
                "tel": "0800000000",
                "lat": "",
                "lng": "",
                "origin_id": "954253",
                "mem_id": 10
            },
            "to": {
                "district": "สีลม",
                "state": "บางรัก",
                "province": "กรุงเทพ",
                "postcode": "10500",
                "country": "Thailand",
                "address": "2/2",
                "name": "ผู้รับ นามสกุล",
                "email": "",
                "tel": "0800000000",
                "lat": "",
                "lng": "",
                "dest_id": 1550442
            },
            "meta": {
                "ref_no_1": "REF1_01",
                "ref_no_2": "REF1_02",
                "referer": null
            },
            "cod_amount": 0,
           
…
```

**`POST {{BASE_URL}}/confirm/` — 3.2 CONFIRM ORDER - ยืนยันใบสั่งซื้อ**

POST 
 Name ( Parameter ) 
 Optional 
 Type 
 Description 
 api_key 
 String 
 Api key for verify Marketplace 
 purchase_id 
 Integer 
 No purchase Shippop 
 RESPONSE CONFIRM PURCHASE 
 Response data SHIPPOP after success
 Name ( Parameter ) 
 Optional 
 Type 
 Description 
 status 
 Boolean 
 True : Success False : fail 
 code 
 yes 
 Integer 
 400 : code 404 : Not found Purchase 
 result[{key}] 
 Array of Object 
 Ref : CONFIRM RESPONSE OBJECT 
 CONFIRM RESPONSE OBJECT 
 Name ( Parameter ) 
 Optional 
 Type 
 Description 
 status 
 Boolean 
 result of this object 
 courier_code 
 String 
 courier_code 
 tracking_code 
 String 
 SHIPPOP tracking code 
 courier_tracking_code 
 String 
 Courier tracking code 
 message 
 yes 
 String 
 Error message

Request (form-data): `api_key`, `purchase_id`

Response example (CONFIRM ORDER - ยืนยันใบสั่งซื้อ - มีบางรายการไม่สำเร็จ):
```json
{
    "status": true,
    "result": {
        "0": {
            "status": false,
            "tracking_code": "SP452030814",
            "courier_tracking_code": "",
            "courier_code": "LLM",
            "message": "'+6608000' is not valid 'phone'. Phone must be: in e.164 format, a valid phone number, and have the correct area code."
        },
        "1": {
            "status": true,
            "tracking_code": "SP452030829",
            "courier_tracking_code": "ST499959975ST",
            "courier_code": "EMST"
        }
    }
}
```

`POST {{BASE_URL}}/update/` — 3.3 UPDATE ORDER - อัพเดทน้ำหนัก

**`POST {{BASE_URL}}/cancel/` — 3.4 CANCEL ORDER - ยกเลิกรายการ**

POST 
 Name ( Parameter ) 
 Optional 
 Type 
 Description 
 api_key 
 String 
 Api key 
 courier_tracking_code 
 String 
 courier tracking code 
 RESPONSE CANCEL 
 Name ( Parameter ) 
 Optional 
 Type 
 Description 
 status 
 boolean 
 True : Success False : Fail 
 code 
 string 
 code error 
 message 
 string 
 message error

Request example:
```json
{
    "api_key": "{{YOUR_API_KEY}}",
    "courier_tracking_code":"SPTH00000000000"
    
}
```

Response example (Success Response):
```json
{
    "status": true
}
```

### 4. Booking Dropoff - สร้างรายการจัดส่ง Shipment Dropoff จาก Partner

`POST {{BASE_URL}}/dropoff/query/` — 4.1 DROPOFF QUERY - สอบถามข้อมูลรายการ Dropoff

`POST {{BASE_URL}}/dropoff/upload-image/` — 4.2 DROPOFF IMAGE - อัปโหลดรูปภาพหลักฐาน Dropoff

`POST {{BASE_URL}}/dropoff/pickup/` — 4.3 DROPOFF PICKUP - สร้างรายการเข้ารับ Dropoff

### 5. Tracking - ตรวจสอบสถานะสินค้า

**`POST {{BASE_URL}}/tracking/` — 5.1 TRACKING ORDER - ตรวจสอบสถานะรายการ**

POST 
 Name ( Parameter ) 
 Optional 
 Type 
 Description 
 tracking_code 
 String 
 SHIPPOP CODE 
 Response 
 Name ( Parameter ) 
 Optional 
 Type 
 Description 
 status 
 Boolean 
 True : Success False : Fail 
 order_status 
 String 
 - wait : Waiting for confirm - unpaid 
- booking : Confirmed - paid 
- invalid : Shipment has some error 
- shipping : Shipment is shipping pending 
- package_detail : Update weight and size (width/length/height) and other price surcharge 
- problem : shipment has problem 
- complete : complete shipment 
- return : shipment return to origin 
 order_cancel_detail 
 yes 
 String 
 remark after order_status = cancel 
 courier_code 
 String 
 Courier code 
 state[]{} 
 yes 
 Object 
 Ref : STATE OBJECT 
 states[] 
 yes 
 Array 
 if order_status = shipping , complete Response state 
 code 
 yes 
 Integer 
 400 : error code 404 : Not found Tracking_code 
 price 
 Number 
 Price this Parcel 
 fuel_surcharge 
 Number 
 Fuel surcharge 
 remote_surcharge 
 Number 
 Extra charge 
 travel_surcharge 
 Number 
 Travel surcharge 
 sms_surcharge 
 Number 
 SMS surcharge 
 STATE OBJECT 
 Name ( Parameter ) 
 Optional 
 Type 
 Description 
 datetime 
 Datetime 
 Date time update status 
 location 
 String 
 State location 
 description 
 String 
 description of this state 
 latlong 
 yes 
 String 
 Lat, Long EX‘12304.1123,12314.00013’ 
 info 
 yes 
 String 
 additional info 
 info[signerTypeText] 
 yes 
 String 
 signature name 
 info[pod] 
 yes 
 String of URL 
 image signature url 
 ตัวอย่างเลข tracking code ตามสถานะ 
 Name ( Parameter ) 
 Description 
 Example tracking code 
 wait 
 waiting for confirm 
 EY337001268TH 
 booking 
 confirm booking 
 SHP001776294 , EY570508677TH 
 shipping 
 shipping 
 860000018463 
 complete 
 complete 
 EY337001461TH , J170100379 
 cancel 
 cancel 
 EY337002590TH 
 return 
 return 
 860000021300, 6300040979

Request example:
```json
{
    "tracking_code": "SP529189074"
}
```

Response example (TRACKING ORDER - กรณีมีการอัพเดทข้อมูลน้ำหนัก/ขนาดจากขนส่ง):
```json
{
    "status": true,
    "order_status": "complete",
    "order_cancel_detail": "",
    "courier_code": "KRYX",
    "tracking_code": "SP529189074",
    "courier_tracking_code": "SHIPBA3102971",
    "state": {
        "0": {
            "status": "010",
            "datetime": "2023-10-17 17:29:47",
            "location": "Bangkok",
            "description": "Shipment picked up ,ขนส่งเข้ารับพัสดุ"
        },
        "1": {
            "status": "102",
            "datetime": "2023-10-17 19:46:33",
            "location": "Bangkok",
            "description": "Arrived at Hub/Transit station ,พัสดุอยู่ที่ศูนย์กระจายสินค้า/สถานีขนส่ง"
        },
        "2": {
            "status": "103",
            "datetime": "2023-10-18 08:17:02",
            "location": "Nonthaburi",
            "description": "Arrived at destination station ,พัสดุอยู่ที่ปลายทาง"
        },
        "3": {
            "status": "045",
            "datetime": "2023-10-18 08:22:02",
            "location": "Nonthaburi",
            "description": "Out for delivery ,เตรียมการจัดส่งพัสดุ"
        },
        "4": {
            "status": "POD",
            "datetime": "2023-10-18 11:17:52",
            "location": "Nonthaburi",
            "description": "Delivery successfully ,จัดส่งพัสดุสำเร็จ นภัทร ธีรเศรณี"
        }
    },
    "states": [
        {
            "status": "010",
            "datetime": "2023-10-17 17:29:47",
            "location": "Bangkok",
            "description": "Shipment picked up ,ขน
…
```

**`POST {{BASE_URL}}/tracking_purchase/` — 5.2 TRACKING PURCHASE - เช็คสถานะใบสั่งซื้อ**

POST 
 Name ( Parameter ) 
 Optional 
 Type 
 Description 
 api_key 
 String 
 Api key for verify Marketplace 
 purchase_id 
 Integer 
 purchase number Shippop 
 email 
 String 
 Email address 
 RESPONSE TRACKING PURCHASE 
 Response data SHIPPOP after success
 Name ( Parameter ) 
 Optional 
 Type 
 Description 
 status 
 Boolean 
 True : Success False : Fail 
 code 
 yes 
 Integer 
 error code 400 ( if Response on status false ) 
 purchase_id 
 Integer 
 Purchase id of Shippop 
 total_price 
 Float 
 Total of this purchase 
 purchase_status 
 String 
 Purchase Status 
paid : paid 
unpaid : unpaid 
cancel : paid fail 
 data[{key}] 
 Array Object 
 Ref : BOOKING RESPONSE OBJECT 
 BOOKING RESPONSE OBJECT
 Name ( Parameter ) 
 Optional 
 Type 
 Description 
 price 
 Number 
 Price this Parcel 
 fuel_surcharge 
 Number 
 Fuel surcharge 
 remote_surcharge 
 Number 
 Extra charge 
 travel_surcharge 
 Number 
 Travel surcharge 
 island_surcharge 
 Number 
 Island surcharge 
 sms_surcharge 
 Number 
 SMS surcharge 
 weight 
 Integer 
 Parcel Weight (g) 
 from 
 Object 
 Ref : Address Object 
 to 
 Object 
 Ref : Address Object 
 courier_code 
 String 
 Courier code 
 tracking_code 
 String 
 SHIPPOP CODE 
 status 
 Boolean 
 - wait : wait confirm 
 datetime_shipping 
 DateTime 
 Datetime Shipping 
 parcel 
 Object 
 Ref : Parcel Object 
 courier_tracking_code 
 String 
 Courier tracking code

Request (form-data): `api_key`, `purchase_id`

Response example (TRACKING PURCHASE - เช็คสถานะใบสั่งซื้อ):
```json
{
    "status": true,
    "purchase_id": 0,
    "total_price": "108.00",
    "total_discount": "0.00",
    "purchase_status": "paid",
    "data": {
        "0": {
            "price": "108.00",
            "fuel_surcharge": "1",
            "remote_surcharge": "20",
            "travel_surcharge": "50",
            "discount": "0.00",
            "weight": 1,
            "from": {
                "address": "ทดสอบเท่านั้น เลขที่ 15 ห้อง 601 ชั้น 6 อาคารเซนจูรี่ เดอะ มูฟวี่ พลาซ่า ถนนพญาไท",
                "district": "แขวงถนนพญาไท",
                "city": "เขตราชเทวี",
                "province": "กรุงเทพมหานคร",
                "postcode": "10400",
                "country": "Thailand",
                "name": "ทดสอบเท่านั้น",
                "email": "aum.chirakid@gmail.com",
                "phone": "0827639234"
            },
            "to": {
                "address": "เลขที่ 15 ห้อง 601 ชั้น 6 อาคารเซนจูรี่ เดอะ มูฟวี่ พลาซ่า ถนนพญาไท แขวงถนนพญาไท เขตราชเทวี กรุงเทพมหานคร 10400",
                "district": "-",
                "city": "-",
                "province": "-",
                "postcode": "23170",
                "country": "Thailand",
                "name": "ทดสอบเท่านั้น",
                "email": "",
                "phone": "0827639234"
            },
            "courier_code": "DHL",
            "tracking_code": "SP418754561",
            "status": "shipping",
            "datetime_shipping": null,
            "datetime_weight": "2023-02-28 09:17
…
```

### 6. Label - ใบปะหน้า

**`POST {{BASE_URL}}/label/` — 6.1 LABEL PURCHASE - ใบปะหน้าโดย purchase**

Request 
 Name ( Parameter ) 
 Optional 
 Type 
 Description 
 api_key 
 String 
 Api key verify Marketplace 
 purchase_id 
 Integer 
 purchase id Shippop 
 tracking_code 
 yes 
 String 
 SHIPPOP code Ex. SP009391312,SP009391327,SP009391331 
 size 
 yes 
 String 
 - A4 : paper size A4 
- A5 : paper size A5 
- A6 : paper size A6 
- letter : size envelop (162x80mm) 
- letter4x6 : size envelop 4*6 (152x90mm) 
- sticker : size sticker 8x8 cm 
- sticker4x6 : size sticker 4x6 inch 
- sticker100x75: size sticker 100x75 mm 
- paperang : size for paperang printer 
 logo 
 yes 
 String 
 Url logo 
 schema 
 yes 
 String 
 "http" or "https" 
otherwise depends on relative path 
 type 
 yes 
 String 
 - html (default) 
- pdf 
- json 
 showproduct 
 yes 
 int 
 Show product detail and order number on label. Available only size sticker4x6 
- 0 = hide product detail (default) 
- 1 = show product detail 
 each 
 yes 
 int 
 0 - not seperate (default) 
1 - seperate 
 options[{tracking_code}] 
 yes 
 Label Option Data Object 
 Replace origin detail on label in case of origin detail is different from Booking API 
 hide_information 
 yes 
 int 
 0 - not hide (default) 
1 - hide receiver infomation

Request example:
```json
{
    "api_key": "{{YOUR_API_KEY}}",
    "purchase_id": "24744979",
    "type":"html",
    "size": "sticker4x6"
}
```

Response example (html):
```json
{
    "status": true,
    "html": "<!DOCTYPE html><html><head><meta charset='utf-8'><meta name='viewport' content='width=device-width, initial-scale=1.0'><title>ใบปะหน้า สติ๊กเกอร์ 4 x 6</title><link rel='preconnect' href='https://fonts.googleapis.com'><link rel='preconnect' href='https://fonts.gstatic.com' crossorigin><link href='https://fonts.googleapis.com/css2?family=Sarabun:wght@400;700&display=swap' rel='stylesheet'><style>body {counter-reset: page;font-family: 'Sarabun', sans-serif;padding:0;margin:auto;width:100mm;} div {overflow:hidden;box-sizing: border-box;-moz-box-sizing: border-box;-webkit-box-sizing: border-box;}.label {display: flex;;position:relative;width: 100mm;height: 150mm;text-align: center;overflow: hidden;margin:0 auto;border:0;}.page-break {clear: both;display: block;page-break-after: always;}img {image-rendering: pixelated;}@media print  {    @page {             size: 4in 6in portrait;             margin: 0;             padding: 0;    }  }</style></head><body><div class='label'><div style='position:absolute;left:9px;top:13px;width:359px;height:149px;border:1px solid rgb(0,0,0);;'>&nbsp;</div><div style='position:absolute;transform: matrix(1,0,0,1,14,23);;width:40px;height:16px;border:0px solid rgb(0,0,0);text-align:left;vertical-align:middle;line-height:normal;font-size:11px;font-weight:bold;;;color:rgb(0,0,0);;line-height:normal;'>ผู้ส่ง</div><div style='white-space: nowrap;overflow: hidden;;;position:absolute;transform: matrix(1,0,0,1,14,51);;width:
…
```

**`POST {{BASE_URL}}/label_tracking_code/` — 6.2 LABEL TRACKING CODE - ใบปะหน้าโดย tracking code**

Request 
 Name ( Parameter ) 
 Optional 
 Type 
 Description 
 api_key 
 String 
 Api key verify Marketplace 
 tracking_code 
 String 
 SHIPPOP code Ex SP009391312,SP009391327,SP009391331 
 size 
 yes 
 String 
 - A4 : paper size A4 
- A5 : paper size A5 
- A6 : paper size A6 
- letter : size envelop (162x80mm) 
- letter4x6 : size envelop 4*6 (152x90mm) 
- sticker : size sticker 8x8 cm 
- sticker4x6 : size sticker 4x6 inch 
 logo 
 yes 
 String 
 Url logo 
 schema 
 yes 
 String 
 "http" or "https" 
otherwise depends on relative path 
 type 
 yes 
 String 
 - html (default) 
- pdf 
- json 
 showproduct 
 yes 
 int 
 Show product detail and order number on label. Available only size sticker4x6 
- 0 = hide product detail (default) 
- 1 = show product detail 
 each 
 yes 
 int 
 0 - not seperate (default) 
1 - seperate 
 options[{tracking_code}] 
 yes 
 Label Option Data Object 
 Replace origin detail on label in case of origin detail is different from Booking API 
 hide_information 
 yes 
 int 
 0 - not hide (default) 
1 - hide receiver infomation

Request example:
```json
{
    "api_key": "{{YOUR_API_KEY}}",
    "tracking_code": "SP522560308,SP522558132",
    "size": "sticker4x6",
    "type": "html",
    "showproduct": 1,
    "options": {
        "SP522560308": {
            "replaceOrigin": {
                "name": "ผู้ส่งต้นทาง1",
                "address": "เลขที่ 15 ห้อง 601 ชั้น 6 อาคารเซนจูรี่ เดอะ มูฟวี่ พลาซ่า",
                "district": "สามเสนใน",
                "state": "พญาไท",
                "province": "กรุงเทพมหานคร",
                "tel": "01234567890"
            },
            "orderDate": "2023-07-01",
            "printDate": "2023-07-02"
        },
        "SP522558132": {
            "replaceOrigin": {
                "name": "ผู้ส่งต้นทาง2",
                "address": "เลขที่ 15 ห้อง 601 ชั้น 6 อาคารเซนจูรี่ เดอะ มูฟวี่ พลาซ่า",
                "district": "สามเสนใน",
                "state": "พญาไท",
                "province": "กรุงเทพมหานคร",
                "tel": "01234567890"
            },
            "orderDate": "2023-07-01",
            "printDate": "2023-07-02"
        }
    }
}
```

Response example (pdf):
```json
{
    "status": true,
    "pdf": "JVBERi0xLjQKMyAwIG9iago8PC9UeXBlIC9QYWdlCi9QYXJlbnQgMSAwIFIKL01lZGlhQm94IFswIDAgMjgzLjQ2IDQyNS4yMF0KL1Jlc291cmNlcyAyIDAgUgovR3JvdXAgPDwvVHlwZSAvR3JvdXAgL1MgL1RyYW5zcGFyZW5jeSAvQ1MgL0RldmljZVJHQj4+Ci9Db250ZW50cyA0IDAgUj4+CmVuZG9iago0IDAgb2JqCjw8L0ZpbHRlciAvRmxhdGVEZWNvZGUgL0xlbmd0aCAxMDU5Pj4Kc3RyZWFtCnictVZLTxtXFN7zK46UTbLg+p5zH3Mnuzakr01axbumC5S46Yui0Ej8HkdIRkRZBeQMaamckWXJyFI8kAp2qOkCS/0RPXcuY88AQ6nbComxfb8553znO49L8NmCFCaC9YUPm9D4SANKISU0v4a7Tf8TCadACxlD8xHcBLiBt6D53dlhjtczvH9VwscLVkgExSdRBBRJoRUsGimUgrUW3K/CyBpBcgqzUjgTYJcEVLyJ+bP8f+3xwhMIx4+B30QUKEFJJQzmof98PBmedgDCc2eSdLNOwQW++AeWLfpAyToftrf8ezcVABJJaWMjF8t5rIZ4KUafb2/1pP+s++4U0MD+ZNQBy6naGk8SsDDKNrL05HmyeZwy4GR79BZ6x78O+PNeP3t+msEw650Mk/cJ7L3I/uhCOz3qnHT3evtZspHOGRtrUmKMErHEshAK5xeKDBeaK4RKx7sAzeX1Vmt9+Sl8/s3qj9//tLy+/O05lwio5nKptXBcedIJpcsSxtaRscqa/46bT5yKBQZRd8RGf9TZT37jShyFz/1BBzbF6+5R71WWvAMkpEtSOx/P4H5Gs8Z4XQejU0LRtDXJCaPna80CT3PRcMYTQBcLHUrkzr0luA0m976bda/FCI0SpDkbxtcbN6vAmDnRlNMUiJFAVwCV9aVyGS5MrzNUXIfSRsjo74059CVSC7sk39UUWe8FYy1im2comRzsJ+P2LDMVuGEHlMNNmOvtwSTr1IAZFbky+E02qIGiIkFYjmN43LnmxPmfDi+piGJ26HIyYykiBMl/Cr38ecMpFwmy8HAFGp8iLK2e56udkAyNY8/a071eJVrtl5JmfWM/WUhYB4ua17C9ptqR9vppNq6C3930sJ2lm+NtXm3Dw2RjksGDm63FO6srK621h60Ht+oE4w43vN+57lQY7e93R8nRi2xneLDPU7h/3GZbr47S9uFmrQmeMpaTkJfJbHMFM/CsL9BIaPCEt7bORGT8BUNxn8vAZ+sgfbtxmv2Stf2uznp+E75+yauMq3r7yiQ/AdKRcHGQMvI5JSmIVdJcE2daUtDy300llicyoCgutuLdDxypSMWEtvnJ9aesIn7o6ZT10VCpDvCKOgh3HJ5XMqyXe2uPWms34PY8S57TE1eMIaIycUx1onHHWFV+YTBOWK
…
```

### 7. Webhook - การส่งข้อมูลสถานะของขนส่ง

`POST {{WEBHOOK_URL}}` — 7.1 Webhook - สถานะขนส่ง

### 8. Notify Pickup - การเรียกขนส่งเข้ารับ

**`POST {{BASE_URL}}/calltopickup/` — 8.1 Call to Pickup - เรียกขนส่งเข้ารับ**

Request Body 
 Parameter 
 Optional 
 Type 
 Description 
 api_key 
 String 
 API Key ของ Marketplace 
 tracking_code 
 String 
 หมายเลขพัสดุของขนส่ง 
courier tracking code 
 num_of_parcel 
 Yes 
 Integer 
 จำนวนพัสดุที่ให้ขนส่งเข้ารับ 
default = 1 
 Additonal Request Body (for Flash Express) 
 Parameter 
 Optional 
 Type 
 Description 
 staff_info_id 
 Yes 
 String 
 ID พนักงานที่ต้องการให้เข้ารับ 
default = ขนส่งไปผู้กำหนด 
 Additional Request Body (for Thailand Post EMS) 
 Parameter 
 Optional 
 Type 
 Description 
 datetime_pickup 
 String 
 เวลาที่นัดหมาย 
ข้อมูลเวลานัดหมายที่แนะนำจากขนส่ง 
- ถ้าสร้างรายการก่อน 11 โมงให้นัดวันเดียวกันเวลา 13.00 
- ถ้าสร้างรายการหลัง 11 โมง รบกวนนัด 9.00ในวันถัดไป 
 origin_name 
 Yes 
(default ยึดตาม tracking) 
 String 
 ชื่อผู้แจ้งให้เข้ารับ 
 origin_phone 
 Yes 
(default ยึดตาม tracking) 
 String 
 เบอร์โทรศัพท์ผู้แจ้งให้เข้ารับ 
 origin_address 
 Yes 
(default ยึดตาม tracking) 
 String 
 ที่อยู่ให้เข้ารับ 
 origin_district 
 Yes 
(default ยึดตาม tracking) 
 String 
 ตำบล/แขวง ที่เข้ารับ 
 origin_city 
 Yes 
(default ยึดตาม tracking) 
 String 
 อำเภอ/เขต ที่เข้ารับ 
 origin_province 
 Yes 
(default ยึดตาม tracking) 
 String 
 จังหวัด ที่เข้ารับ 
 origin_postcode 
 Yes 
(default ยึดตาม tracking) 
 String 
 รหัสไปรณีย์ ที่เข้ารับ 
 Response Body 
 Parameter 
 Optional 
 Type 
 Description 
 status 
 boolean 
 courier_ticket_id 
 String 
 รหัส Booking ID จากขนส่ง 
 courier_pickup_id 
 Integer 
 รหัส Booking ID ของ SHIPPOP 
 data 
 Yes 
 Object 
 ข้อมูลเพิ่มเติมจากขนส่ง

Request example:
```json
{
    "api_key": "{{YOUR_API_KEY}}",
    "tracking_code": "{{COURIER_TRACKING_CODE}}"
}
```

Response example (Flash Express):
```json
{
    "status": true,
    "courier_ticket_id": {{COURIER_TICKET_ID}},
    "courier_pickup_id": {{COURIER_PICKUP_ID}},
    "data": [
        {
            "courierPickupId": {{COURIER_PICKUP_ID}},
            "ticketPickupId": {{COURIER_TICKET_ID}},
            "pickupInfo": {
                "staffName": null,
                "staffPhone": null
            }
        }
    ]
}
```

`POST {{BASE_URL}}/calltopickup/flash/` — 8.2 Call to Pickup Flash Express - เรียกขนส่ง Flash Express เข้ารับ

**`POST {{BASE_URL}}/pickup/` — 8.3 Get Pickup List - แสดงรายการที่ขนส่งเข้ารับ**

Request Body 
 Parameter 
 Optional 
 Type 
 Description 
 api_key 
 String 
 API Key ของ Marketplace 
 page 
 Yes 
 Integer 
 หน้าที่ต้องการแสดง 
default = 1 
 perpage 
 Yes 
 Integer 
 จำนวนรายการต่อหน้า 
default = 25 
 created_at 
 Yes 
 Object {start,end} 
 filter ช่วงเวลาที่สร้างรายการเข้ารับ 
start : วันเวลาเริ่มต้น 
end : วันเวลาจบ 
 courier_codes 
 Yes 
 Array[String] 
 filter ขนส่งที่ต้องการโดย courier_code 
default = ทุก courier 
 origin_ids 
 Yes 
 Array[Integer] 
 filter id ของที่อยู่เข้ารับ 
*โดย origin_id จะได้รับจากการสร้างรายการผ่าน API Booking 
 courier_pickup_ids 
 Yes 
 Array[Integer] 
 filter courier_pickup_id ของ SHIPPOP 
 courier_ticket_pickup_ids 
 Yes 
 Array[Integer] 
 filter id ticket ของขนส่ง 
 Response Body 
 Field 
 Description 
 id 
 courier_pickup_id ใช้ในการ cancel

Request example:
```json
{
    "api_key": "{{YOUR_API_KEY}}",
    "page": 1,
    "created_at": {
        "start": "2023-04-26 00:00:00",
        "end": "2023-04-26 23:59:59"
    },
    "courier_codes": [
        "FLE"
    ],
    "origin_ids": [
        952941
    ],
    "courier_ticket_pickup_ids": [
        1111
    ]
}
```

Response example (Get pickup list):
```json
{
    "status": true,
    "data": {
        "items": [
            {
                "id": 229,
                "origin_id": 953006,
                "courier_code": "FLE",
                "courier_ticket_pickup_id": "16123773",
                "courier_staff_id": null,
                "courier_staff_name": null,
                "courier_staff_phone": null,
                "courier_message_text_1": null,
                "courier_message_text_2": null,
                "estimate_at_text": null,
                "state": "allocating",
                "created_at": "2023-05-02 10:45:39",
                "updated_at": "2023-05-02 10:45:39",
                "completed_at": null,
                "origin_address": {
                    "text": "บ้านคุณลิซ่า จตุจักร จตุจักร กรุงเทพมหานคร 10900"
                }
            }
        ],
        "pages": 1,
        "page": 1,
        "perpage": 25,
        "total": "1"
    }
}
```

`POST {{BASE_URL}}/pickup/update/` — 8.4 Update Pickup - แก้ไขรายการเข้ารับ

`POST {{BASE_URL}}/pickup/cancel/` — 8.5 Cancel Pickup - ยกเลิกการเรียกขนส่งเข้ารับ

`POST {{WEBHOOK_NOTIFY_PICKUP_URL}}` — 8.6 Webhook Notify Pickup Flash

### 9. Verify Account - ยืนยันตัวตน

#### 9.1 (API) Verify Account - ยืนยันตัวตนผ่าน API

#### 9.1.1 Register API - ลงทะเบียนสมาชิก

`POST {{BASE_URL}}/register/` — Register - ลงทะเบียนอีเมล

#### 9.1.2 Member Identity - จัดการข้อมูลยืนยันตัวตน

`POST {{BASE_URL}}/identity/create/` — CreateMemberIdentity - เพิ่มข้อมูลยืนยันตัวตน

`POST {{BASE_URL}}/identity/fetch/` — FetchMemberIdentity - ขอข้อมูลยืนยันตัวตน

#### 9.1.3 Billing - จัดการข้อมูลใบแจ้งหนี้ (Invoice/Receipt)

`POST {{BASE_URL}}/billing/create/` — CreateBilling -  เพิ่มข้อมูลออกใบแจ้งหนี้

`POST {{BASE_URL}}/billing/update/` — UpdateBilling - แก้ไขข้อมูลใบแจ้งหนี้

#### 9.1.4 Bank Account - จัดการข้อมูลบัญชีธนาคาร

`POST {{BASE_URL}}/bank/create/` — CreateBankAccount - เพิ่มข้อมูลบัญชีธนาคาร

`POST {{BASE_URL}}/bank/create/` — CreateBankAccount - เพิ่มข้อมูลบัญชีธนาคาร Copy

`POST {{BASE_URL}}/bank/fetch/` — FetchBankAccount - ข้อมูลบัญชีธนาคาร

#### 9.1.5 Member - ข้อมูลสมาชิก

`POST {{BASE_URL}}/member/` — FetchMember - ขอข้อมูลสมาชิก

#### 9.2 (UI) Verify Account - ยืนยันตัวตนผ่าน UI ของ SHIPPOP

`POST {{MEMBER_SERVICE_BASE_URL}}/api/verify/gen-verify-link` — 9.2.1 Generate Verify UI Link - สร้าง URL ยืนยันตัวตน

`POST {{MEMBER_SERVICE_BASE_URL}}/api/verify/platform-get-info` — 9.2.2 Confirmation Info - ขอข้อมูลยืนยันลูกค้า

### 10. Rebate - สร้างรายการด้วย Account ขนส่งของตนเอง

`POST {{BASE_URL}}/rebate/set_credential/` — 10.1 Rebate Register - ลงทะเบียน Account ขนส่ง

`POST {{BASE_URL}}/rebate/booking/` — 10.2 Rebate Booking - สร้างรายการ

### 11. (Optional) Open Account - เปิดบัญชี SHIPPOP PRO

`POST {{BASE_URL}}/open_account/` — 11.1 Open Account - เปิดบัญชี SHIPPOP PRO

### 12. Report - รายงานต่างๆ

`POST {{BASE_URL}}/report-delivered/` — REPORT Delivered - รายงานการจัดส่ง

`POST {{BASE_URL}}/report-shipment/` — REPORT Shipment - รายงานรายละเอียดพัสดุ

`POST {{BASE_URL}}/report-cod/` — REPORT COD - รายการเก็บเงินปลายทาง

`POST {{BASE_URL}}/report-cod/summary/` — REPORT COD Summary - รายงานสรุปยอด COD รายวัน

`POST {{BASE_URL}}/report-cod/transfer/date/` — REPORT COD Transfer - รายงานโอนเงินค่าเก็บเงินปลายทาง

`POST {{BASE_URL}}/report-billing-orders/` — REPORT BILLING ORDERS - รายงานรายการที่เรียกเก็บบิล

### 13. Fail Report - รายการขนส่งที่มีปัญหา

`POST {{BASE_URL}}/fetch-order-problem/` — Get Problem List - แสดงรายการขนส่งที่เกิดปัญหา

`POST {{BASE_URL}}/update-order-problem/feedback/` — Feedback - ตอบกลับรายการขนส่งที่เกิดปัญหา

### 14. Box Setting - ตั้งค่าข้อมูลกล่อง

`POST {{BASE_URL}}/box-setting/create/` — Create box

`POST {{BASE_URL}}/box-setting/update/` — Update box

`POST {{BASE_URL}}/box-setting/` — List (effective catalog)

`POST {{BASE_URL}}/box-setting/delete/` — Delete box

`POST {{BASE_URL}}/box-setting/update/` — Disable box (status=0)

`POST {{BASE_URL}}/box-setting/reset/` — Clear all (Reset)

`POST {{BASE_URL}}/box-setting/seed/` — Seed Default

### Other - อื่นๆ

`POST https://mkpservice.shippop.dev/postoffice/` — GET THAILAND POST OFFICE

`POST https://mkpservice.shippop.dev/check-code-available/krys/` — Kerry SHOP ตรวจสอบ Promotion 19 บาท

`POST https://www.shippop.com/api/dropoff/popshop/nearby` — New Request

## Crossborder v2 APIs

Implemented as the `shippop_inter_*` tools (base `https://inter.shippop.com`, JWT auth from account login). Not snapshotted here — see the "Crossborder v2 APIs" folder of the official Postman collection: https://documenter.getpostman.com/view/10021496/Tzz8qwkE
