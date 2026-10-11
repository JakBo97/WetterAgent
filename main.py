import requests
from datetime import datetime, timedelta

def get_coordinates(location):
    url = "https://geocoding-api.open-meteo.com/v1/search"

    parameters = {
        "name": location,
        "count": 1,
        "language": "en",
        "format": "json"
    }

    response = requests.get(url, params=parameters)

    data = response.json()

    return data

def get_weather(latitude, longitude):
    url = "https://api.open-meteo.com/v1/forecast"

    parameters = {
        "latitude": latitude,
        "longitude": longitude,
        "current": [
            "temperature_2m",
            "apparent_temperature",
            "relative_humidity_2m",
            "wind_speed_10m",
            "wind_gusts_10m",
            "wind_direction_10m",
            "cloud_cover",
            "precipitation",
            "weather_code",
            "shortwave_radiation"
        ],
        "hourly": [
            "temperature_2m",
            "apparent_temperature",
            "relative_humidity_2m",
            "wind_speed_10m",
            "wind_gusts_10m",
            "wind_direction_10m",
            "cloud_cover",
            "precipitation_probability",
            "precipitation",
            "weather_code",
            "shortwave_radiation"
        ],

        "timezone": "Europe/Berlin"
    }

    response = requests.get(url, params=parameters)

    data = response.json()

    return data

def get_weather_for_location(location):
    coordinates = get_coordinates(location)

    latitude = coordinates["results"][0]["latitude"]
    longitude = coordinates["results"][0]["longitude"]

    weather = get_weather(latitude, longitude)

    return weather

def get_forecast_hours(weather, start_time, end_time):
    hourly = weather["hourly"]

    times = hourly["time"]
    temperatures = hourly["temperature_2m"]
    feels_like = hourly["apparent_temperature"]
    humidity = hourly["relative_humidity_2m"]
    wind_speeds = hourly["wind_speed_10m"]
    wind_gusts = hourly["wind_gusts_10m"]
    wind_directions = hourly["wind_direction_10m"]
    cloud_cover = hourly["cloud_cover"]
    rain_probabilities = hourly["precipitation_probability"]
    precipitation = hourly["precipitation"]
    weather_codes = hourly["weather_code"]
    solar_radiation = hourly["shortwave_radiation"]

    forecast = []

    for i in range(len(times)):
        forecast_time = datetime.fromisoformat(times[i])

        if start_time <= forecast_time <= end_time:
            forecast.append({
                "time": forecast_time,
                "temperature": temperatures[i],
                "feels_like": feels_like[i],
                "humidity": humidity[i],
                "wind_speed": wind_speeds[i],
                "wind_gusts": wind_gusts[i],
                "wind_direction": wind_directions[i],
                "cloud_cover": cloud_cover[i],
                "rain_probability": rain_probabilities[i],
                "precipitation": precipitation[i],
                "weather_code": weather_codes[i],
                "solar_radiation": solar_radiation[i]
            })

    return forecast

def get_next_forecast_hour(current_time):
    if current_time.minute == 0 and current_time.second == 0:
        return current_time

    next_hour = current_time.replace(
        minute=0,
        second=0,
        microsecond=0
    )

    next_hour = next_hour + timedelta(hours=1)

    return next_hour

def get_weather_at_time(weather, target_time):
    forecast = weather["hourly"]

    times = forecast["time"]

    for i in range(len(times)):
        forecast_time = datetime.fromisoformat(times[i])

        if forecast_time == target_time:
            return {
                "time": forecast_time,
                "temperature": forecast["temperature_2m"][i],
                "feels_like": forecast["apparent_temperature"][i],
                "humidity": forecast["relative_humidity_2m"][i],
                "wind_speed": forecast["wind_speed_10m"][i],
                "wind_gusts": forecast["wind_gusts_10m"][i],
                "wind_direction": forecast["wind_direction_10m"][i],
                "cloud_cover": forecast["cloud_cover"][i],
                "rain_probability": forecast["precipitation_probability"][i],
                "precipitation": forecast["precipitation"][i],
                "weather_code": forecast["weather_code"][i],
                "solar_radiation": forecast["shortwave_radiation"][i]
            }

    return None

def analyze_riding_conditions(weather_data):
    temperature = weather_data["temperature"]
    feels_like = weather_data["feels_like"]
    wind_speed = weather_data["wind_speed"]
    wind_gusts = weather_data["wind_gusts"]
    rain_probability = weather_data["rain_probability"]

    # Temperature classification
    if feels_like < 5:
        temperature_condition = "VERY COLD"
    elif feels_like < 12:
        temperature_condition = "COLD"
    elif feels_like < 18:
        temperature_condition = "COOL"
    elif feels_like < 25:
        temperature_condition = "COMFORTABLE"
    elif feels_like < 30:
        temperature_condition = "WARM"
    else:
        temperature_condition = "HOT"

    # Wind classification
    if wind_gusts >= 50:
        wind_condition = "VERY WINDY"
    elif wind_gusts >= 35:
        wind_condition = "WINDY"
    elif wind_gusts >= 20:
        wind_condition = "MODERATE"
    else:
        wind_condition = "LIGHT"

    # Rain classification
    if rain_probability >= 60:
        rain_condition = "HIGH RAIN RISK"
    elif rain_probability >= 30:
        rain_condition = "MODERATE RAIN RISK"
    elif rain_probability >= 10:
        rain_condition = "LOW RAIN RISK"
    else:
        rain_condition = "VERY LOW RAIN RISK"

    return {
        "temperature_condition": temperature_condition,
        "wind_condition": wind_condition,
        "rain_condition": rain_condition
    }

def get_overall_condition(riding_conditions):
    temperature_condition = riding_conditions["temperature_condition"]
    wind_condition = riding_conditions["wind_condition"]
    rain_condition = riding_conditions["rain_condition"]

    # High rain risk takes priority
    if rain_condition == "HIGH RAIN RISK":
        return "RAINY"

    # Moderate rain risk
    if rain_condition == "MODERATE RAIN RISK":
        return "RAIN POSSIBLE"

    # Very windy conditions
    if wind_condition == "VERY WINDY":
        return "VERY WINDY"

    if wind_condition == "WINDY":
        if temperature_condition == "COLD":
            return "COLD AND WINDY"

        if temperature_condition == "COOL":
            return "COOL AND WINDY"

        return "WINDY"

    # Temperature-based conditions
    if temperature_condition == "VERY COLD":
        return "VERY COLD"

    if temperature_condition == "COLD":
        return "COLD"

    if temperature_condition == "COOL":
        return "COOL"

    if temperature_condition == "HOT":
        return "HOT"

    if temperature_condition == "WARM":
        return "WARM"

    return "GOOD RIDING CONDITIONS"

def get_quick_status(weather_data, riding_conditions):
    temperature = weather_data["temperature"]
    rain_probability = weather_data["rain_probability"]

    temperature_condition = riding_conditions["temperature_condition"]
    wind_condition = riding_conditions["wind_condition"]
    rain_condition = riding_conditions["rain_condition"]

    # High rain risk
    if rain_probability >= 60:
        status = "CAUTION"
        message = "High rain risk."

    # Very strong wind
    elif wind_condition == "VERY WINDY":
        status = "CAUTION"
        message = "Strong wind and gusts."

    # Cold conditions
    elif temperature_condition in ["VERY COLD", "COLD"]:
        status = "COOL"
        message = "Cold conditions for riding."

    # Otherwise
    else:
        status = "GOOD"
        message = "Good riding conditions."

    return {
        "status": status,
        "message": message
    }

def get_clothing_recommendation(weather_data, riding_conditions):
    feels_like = weather_data["feels_like"]
    rain_probability = weather_data["rain_probability"]

    temperature_condition = riding_conditions["temperature_condition"]
    wind_condition = riding_conditions["wind_condition"]

    recommendation = {
        "base_layer": None,
        "jacket": None,
        "gloves": None,
        "pants": None,
        "rain_gear": False
    }

    # Base layer
    if feels_like < 10:
        recommendation["base_layer"] = "Thermal base layer"
    elif feels_like < 18:
        recommendation["base_layer"] = "Long sleeve base layer"
    else:
        recommendation["base_layer"] = "T-shirt"

    # Motorcycle jacket
    if temperature_condition in ["VERY COLD", "COLD"]:
        recommendation["jacket"] = "Heavy motorcycle jacket"
    elif temperature_condition == "COOL":
        recommendation["jacket"] = "Medium motorcycle jacket"
    elif temperature_condition in ["COMFORTABLE", "WARM"]:
        recommendation["jacket"] = "Light motorcycle jacket"
    else:
        recommendation["jacket"] = "Light motorcycle jacket"

    # Gloves
    if feels_like < 10:
        recommendation["gloves"] = "Winter motorcycle gloves"
    elif feels_like < 18:
        recommendation["gloves"] = "Mid-season motorcycle gloves"
    else:
        recommendation["gloves"] = "Summer motorcycle gloves"

    # Pants
    if feels_like < 12:
        recommendation["pants"] = "Warm motorcycle pants"
    else:
        recommendation["pants"] = "Motorcycle jeans or light motorcycle pants"

    # Rain gear
    if rain_probability >= 50:
        recommendation["rain_gear"] = True

    # Strong wind can justify an additional layer
    if wind_condition in ["WINDY", "VERY WINDY"]:
        if recommendation["base_layer"] == "T-shirt":
            recommendation["base_layer"] = "Long sleeve base layer"

    return recommendation

def get_weather_alert(forecast):
    current_hour = forecast[0]

    current_rain_probability = current_hour["rain_probability"]
    current_temperature = current_hour["temperature"]

    for hour in forecast[1:]:
        hours_from_now = (
            hour["time"] - current_hour["time"]
        ).total_seconds() / 3600

        # Rain approaching
        if (
            hour["rain_probability"] >= 60
            and current_rain_probability < 60
        ):
            return {
                "type": "RAIN",
                "hours_until": round(hours_from_now, 1),
                "rain_probability": hour["rain_probability"],
                "time": hour["time"],
                "message": (
                    f"Rain expected in about "
                    f"{round(hours_from_now, 1)} hours."
                )
            }

        # Significant temperature drop
        if current_temperature - hour["temperature"] >= 5:
            return {
                "type": "TEMPERATURE_DROP",
                "hours_until": round(hours_from_now, 1),
                "temperature": hour["temperature"],
                "time": hour["time"],
                "message": (
                    f"Temperature will drop to "
                    f"{hour['temperature']}°C."
                )
            }

    return None

def build_homepage_data(weather, forecast):
    current_weather = weather["current"]

    # Use the next forecast hour for rain probability
    next_hour = forecast[0]

    current_data = {
        "temperature": current_weather["temperature_2m"],
        "feels_like": current_weather["apparent_temperature"],
        "wind_speed": current_weather["wind_speed_10m"],
        "wind_gusts": current_weather["wind_gusts_10m"],
        "rain": current_weather["precipitation"],
        "rain_probability": next_hour["rain_probability"]
    }

    riding_conditions = analyze_riding_conditions(
        current_data
    )

    overall_condition = get_overall_condition(
        riding_conditions
    )

    quick_status = get_quick_status(
        current_data,
        riding_conditions
    )

    weather_alert = get_weather_alert(
        forecast
    )

    return {
        "current": current_data,
        "riding_conditions": riding_conditions,
        "overall_condition": overall_condition,
        "quick_status": quick_status,
        "weather_alert": weather_alert
    }


location = "Freising, Germany"

weather = get_weather_for_location(location)

print("================================")
print("          MOTOWEATHER")
print("================================")

print()

print("Location:", location)

print()

current_time = datetime.now()

start_time = get_next_forecast_hour(current_time)
end_time = start_time + timedelta(hours=5)

forecast = get_forecast_hours(
    weather,
    start_time,
    end_time
)

homepage = build_homepage_data(
    weather,
    forecast
)

current = homepage["current"]
quick_status = homepage["quick_status"]
weather_alert = homepage["weather_alert"]

print("CURRENT WEATHER")
print("----------------")
print("Temperature:", current["temperature"], "°C")
print("Feels like:", current["feels_like"], "°C")
print("Wind:", current["wind_speed"], "km/h")
print("Wind gusts:", current["wind_gusts"], "km/h")

print()

print("RIDING STATUS")
print("-------------")
print(quick_status["status"])
print(quick_status["message"])

print()

if weather_alert:
    print("WEATHER ALERT")
    print("-------------")
    print(weather_alert["message"])
else:
    print("WEATHER ALERT")
    print("-------------")
    print("No significant weather changes expected.")

print()

print("RIDING CONDITIONS")
print("-----------------")
print("Temperature:", homepage["riding_conditions"]["temperature_condition"])
print("Wind:", homepage["riding_conditions"]["wind_condition"])
print("Rain:", homepage["riding_conditions"]["rain_condition"])

print()

print("================================")