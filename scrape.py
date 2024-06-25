import os
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, StaleElementReferenceException
from time import sleep
import pandas as pd
import concurrent.futures

os.getcwd()
new_path=os.path.join(os.getcwd(),"imgs")
images=[]
for img in os.listdir(new_path):
    if img.split('\\')[-1].split('.')[-1] in ['png','jpg','jpeg']:
        images.append(new_path+'\\'+img)

def get_product_details(path):
    no_of_max_retries=2
    retries=0
    while True:  # Loop to retry on TimeoutException
        try:
            driver_path = r"chromedriver-win64\chromedriver.exe"
            service = Service(executable_path=driver_path)
            options = Options()
            options.add_argument("--headless")
            options.add_argument('--allow-running-insecure-content')
            options.add_argument('--ignore-certificate-errors')
            driver = webdriver.Chrome(service=service, options=options)
            driver.get("https://www.amazon.com/shopthelook?q=local&ref_=vs_lns")

            WebDriverWait(driver, 10).until(EC.presence_of_element_located((By.XPATH, '//input[@id="file"]')))
            file_input = driver.find_element(By.XPATH, '//input[@id="file"]')
            file_input.send_keys(path)

            pdt_link = []
            pdt_image_link = []
            pdt_name = []
            pdt_price = []

            WebDriverWait(driver, 10).until(EC.presence_of_all_elements_located((By.XPATH, "//div[@class='overlay-white-semitransparent']")))
            pdts_img_link = driver.find_elements(By.XPATH, "//div[@class='overlay-white-semitransparent']")
#             req_len = min(5, len(pdts_img_link))
            for pdts in pdts_img_link:
                # Product Links
                pdt_links = pdts.find_elements(By.XPATH, "./a")
                for links in pdt_links:
                    pdt_link.append(links.get_attribute('href') if links else "0")

                # Product Image Links
                pdt_images = pdts.find_elements(By.XPATH, "./a/img")
                for images in pdt_images:
                    pdt_image_link.append(images.get_attribute('src') if images else "0")


            WebDriverWait(driver, 10).until(EC.presence_of_all_elements_located((By.XPATH, "//section[@class='item-details-container']/a")))
            pdts_info = driver.find_elements(By.XPATH, "//section[@class='item-details-container']/a")
#             req_len = min(5, len(pdts_info))
            for info in pdts_info:
                # Product_price
                pdt_prices = info.find_elements(By.XPATH, "./div[@class='prices']/ins/span/span/span[@class='a-price-whole']")
                for cost in pdt_prices:
                    pdt_price.append(float(cost.text) * 83.58 if cost else "0")

                # Product_Name
                pdt_names = info.find_elements(By.XPATH, "./h5")
                for names in pdt_names:
                    pdt_name.append(names.text if names else "0")

            print("No.of Links-->", len(pdt_link))
            print("No.of Image Links-->", len(pdt_image_link))
            print("No.of Price-->", len(pdt_price))
            print("No.of Names-->", len(pdt_name))

            df = pd.DataFrame(zip(pdt_name, pdt_price, pdt_image_link, pdt_link),
                              columns=['Product_Name', 'Product_Price', 'Product_Image_link', 'Product_link'])
            image_name = os.path.basename(path).split('.')[0]
            df.to_excel(f"sheets\\{image_name}.xlsx", index=False)

            break

        except TimeoutException as e:
            print(f"TimeoutException occurred: {e}\nRetrying...\n")
            if retries<no_of_max_retries:
                retries+=1
                continue  # Skip all remaining lines and Retry the whole process
            else:
                break
        except StaleElementReferenceException as e:
            print(f"StaleElementReferenceException occurred: {e}")
            break  
        except Exception as e:
            print(f"Exception occurred: {e}")
            break
        finally:
            try:
                driver.quit()
            except Exception as e:
                print(f"Exception occurred while quitting driver: {e}")

with concurrent.futures.ThreadPoolExecutor() as executor:
    executor.map(get_product_details,images)