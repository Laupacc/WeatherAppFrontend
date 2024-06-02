import React, { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { updateCities } from "../reducers/city.js";
import Box from "@mui/material/Box";
import { FaCirclePlus, FaCircleMinus } from "react-icons/fa6";
import Typography from "@mui/material/Typography";
import Modal from "@mui/material/Modal";
import Alert from "@mui/material/Alert";
import ReactCountryFlag from "react-country-flag";
import { useMemo } from "react";
import moment from "moment-timezone";
import { ProgressBar } from "react-loader-spinner";
import { ImArrowUp } from "react-icons/im";

function City() {
  const dispatch = useDispatch();
  const cities = useSelector((state) => state.city.city);
  const user = useSelector((state) => state.user.value);
  const unit = useSelector((state) => state.city.unit);
  const sortCriteria = useSelector((state) => state.city.sortCriteria);
  const sortOrder = useSelector((state) => state.city.sortOrder);

  const [cityNames, setCityNames] = useState([]);
  const [forecastData, setForecastData] = useState(null);
  const [selectedCity, setSelectedCity] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDayForecast, setSelectedDayForecast] = useState(null);
  const [selectedButton, setSelectedButton] = useState(0);
  const [cityDeleted, setCityDeleted] = useState("");
  const [loading, setLoading] = useState(true);
  const [boxVisible, setBoxVisible] = useState(null);

  // Remove the city deleted alert after 3 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setCityDeleted("");
    }, 3000);
    return () => clearTimeout(timer);
  }, [cityDeleted]);

  // Fetch updated city data
  useEffect(() => {
    const fetchUpdatedCities = async () => {
      if (user.token) {
        // localStorage.removeItem("cities");
        try {
          // Trigger the update of all cities' weather data
          const updateResponse = await fetch(
            `https://under-the-weather-backend.vercel.app/weather/updateUserCities?token=${user.token}`
          );

          const updateData = await updateResponse.json();
          console.log("Update Response:", updateData);
          if (!updateData.result) {
            console.error("Error updating cities:", updateData.error);
            return;
          }

          // Fetch the updated city data
          const response = await fetch(
            `https://under-the-weather-backend.vercel.app/weather/userCities?token=${user.token}`
          );

          const data = await response.json();
          console.log("Weather Data:", data);

          if (data.cities) {
            const formattedCities = data.cities.map((city) => {
              return {
                ...city,
                sunrise: moment
                  .unix(city.sunrise)
                  .utcOffset(city.timezone / 60)
                  .format("HH:mm"),
                sunset: moment
                  .unix(city.sunset)
                  .utcOffset(city.timezone / 60)
                  .format("HH:mm"),
              };
            });
            setCityNames(formattedCities.reverse());
          }
        } catch (error) {
          console.error("Error fetching cities:", error);
        } finally {
          setLoading(false);
        }
      } else if (!user.token) {
        // User is not authenticated, fetch cities from local storage
        const localCities = JSON.parse(localStorage.getItem("cities")) || [];

        if (localCities.length > 0) {
          try {
            // Fetch updated data for each city in local storage
            const updatedCities = await Promise.all(
              localCities.map(async (city) => {
                const response = await fetch(
                  `https://under-the-weather-backend.vercel.app/weather/localStorageCities?cityName=${city.cityName}&country=${city.country}`
                );
                const data = await response.json();
                if (data.result) {
                  return {
                    ...data.weather,
                    sunrise: moment
                      .unix(data.weather.sunrise)
                      .utcOffset(data.weather.timezone / 60)
                      .format("HH:mm"),
                    sunset: moment
                      .unix(data.weather.sunset)
                      .utcOffset(data.weather.timezone / 60)
                      .format("HH:mm"),
                  };
                } else {
                  throw new Error(data.error);
                }
              })
            );

            setCityNames(updatedCities.reverse());
          } catch (error) {
            console.error("Error fetching cities:", error);
          } finally {
            setLoading(false);
          }
        }
      }
    };

    fetchUpdatedCities();
  }, [cities, user.token]);

  // Delete city from the user's list
  const deleteCityFromUser = async (cityName) => {
    console.log("City Name:", cityName);
    if (user.token) {
      try {
        const response = await fetch(
          "https://under-the-weather-backend.vercel.app/deleteCity",
          {
            method: "DELETE",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ token: user.token, cityName }),
          }
        );
        const data = await response.json();
        console.log("Delete City Response:", data);
        if (data.result) {
          setCityNames(data.cities);
          setCityDeleted(
            `${data.cityName
              .split(" ")
              .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
              .join(" ")} (${data.country}) was deleted successfully`
          );
        }
      } catch (error) {
        setCityDeleted("");
        console.error("Error deleting city from user's list:", error);
      }
    } else if (!user.token) {
      // If the user is not logged in, delete the city from local storage
      const city = cities.find(
        (city) => city.cityName.toLowerCase() === cityName.toLowerCase()
      );
      const country = city
        ? deleteCityFromLocalStorage(cityName)
        : deleteCityFromLocalStorage(cityName);
      if (country) {
        setCityDeleted(
          `${cityName
            .split(" ")
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(" ")} (${country}) was deleted successfully`
        );
        console.log("City Deleted:", cityName);
      }
    }
  };

  // Function to delete city from local storage
  const deleteCityFromLocalStorage = (cityName, lat, lon) => {
    const localCities = JSON.parse(localStorage.getItem("cities")) || [];
    let cityIndex = -1;

    // If coordinates are provided, find the city by coordinates
    if (lat && lon) {
      cityIndex = localCities.findIndex(
        (city) => city.lat === lat && city.lon === lon
      );
    } else {
      // Otherwise, find the city by name
      cityIndex = localCities.findIndex(
        (city) => city.cityName.toLowerCase() === cityName.toLowerCase()
      );
    }

    if (cityIndex !== -1) {
      const country = localCities[cityIndex].country;
      localCities.splice(cityIndex, 1);
      localStorage.setItem("cities", JSON.stringify(localCities));

      dispatch(updateCities(localCities));

      return country;
    }
    return null;
  };

  // Get forecast data for a city
  const fetchForecast = async (cityName) => {
    try {
      const response = await fetch(
        `https://under-the-weather-backend.vercel.app/weather/forecast/${cityName}`
      );
      const data = await response.json();
      if (data.weather.list) {
        // Get the timezone offset of the city
        const cityTimezoneOffset = data.weather.city.timezone / 60;

        // Convert the forecast data to the city's timezone
        const forecastData = data.weather.list.map((forecast) => {
          const date = moment
            .utc(forecast.dt_txt)
            .utcOffset(cityTimezoneOffset);
          forecast.dt_txt = date.format("YYYY-MM-DD HH:mm:ss");
          return forecast;
        });

        setForecastData(forecastData);

        // Show the forecast for the current day by default when opening the modal
        const selectedDate = moment
          .utc()
          .utcOffset(cityTimezoneOffset)
          .format("YYYY-MM-DD"); // Current date

        // Filter forecasts for the selected day
        const selectedDayForecasts = forecastData.filter((forecast) => {
          const forecastDate = moment
            .utc(forecast.dt_txt)
            .utcOffset(cityTimezoneOffset)
            .format("YYYY-MM-DD"); // Extracting date from datetime string
          return forecastDate === selectedDate;
        });
        setSelectedDayForecast(selectedDayForecasts);

        setIsModalOpen(true);
      }
    } catch (error) {
      console.error("Error fetching forecast:", error);
    }
  };

  // Handle forecast data
  const handleForecast = (cityName) => {
    setSelectedCity(cityName);
    fetchForecast(cityName);
  };

  // Close the modal
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setForecastData(null);
    setSelectedButton(0);
  };

  // Handle day click inside the modal
  const handleDayClick = (dailyForecast, index) => {
    setSelectedDayForecast(dailyForecast);
    setSelectedButton(index);
  };

  // Format date to display in the modal
  const getFormattedDate = (dateString) => {
    const date = new Date(dateString);
    const day = date.getDate();
    let suffix = "th";
    if (day === 1 || day === 21 || day === 31) {
      suffix = "st";
    } else if (day === 2 || day === 22) {
      suffix = "nd";
    } else if (day === 3 || day === 23) {
      suffix = "rd";
    }
    const weekday = date.toLocaleDateString("en-US", { weekday: "long" });
    const month = date.toLocaleDateString("en-US", { month: "long" });
    return `${weekday}, ${month} ${day}${suffix}`;
  };

  // Generate Google search link
  const generateGoogleSearchLink = (cityName) => {
    return `https://www.google.com/search?q=${encodeURIComponent(cityName)}`;
  };

  // Convert temperature to Fahrenheit
  const convertTemperature = (temperature) => {
    if (unit === "Fahrenheit") {
      return (temperature * 9) / 5 + 32;
    }
    return temperature;
  };

  // Format temperature to display in the UI
  const formatTemperature = (temperature) => {
    return `${Math.round(convertTemperature(temperature))}°${
      unit === "Fahrenheit" ? "F" : "C"
    }`;
  };

  // Toggle visibility of the weather details box
  const toggleBoxVisibility = (cityName) => {
    setBoxVisible(boxVisible === cityName ? null : cityName);
  };

  // Background images for different weather conditions
  const backgroundImages = {
    "01d": "backgrounds/01d.jpg",
    "01n": "backgrounds/01n.jpg",
    "02d": "backgrounds/02d.jpg",
    "02n": "backgrounds/02n.jpg",
    "03d": "backgrounds/03d.jpg",
    "03n": "backgrounds/03n.jpg",
    "04d": "backgrounds/04d.jpg",
    "04n": "backgrounds/04n.jpg",
    "09d": "backgrounds/09d.jpg",
    "09n": "backgrounds/09n.jpg",
    "10d": "backgrounds/10d.jpg",
    "10n": "backgrounds/10n.jpg",
    "11d": "backgrounds/11d.jpg",
    "11n": "backgrounds/11n.jpg",
    "13d": "backgrounds/13d.jpg",
    "13n": "backgrounds/13n.jpg",
    "50d": "backgrounds/50d.jpg",
    "50n": "backgrounds/50n.jpg",
  };
  const getBackgroundImage = (icon) =>
    backgroundImages[icon] || "backgrounds/02d.jpg";

  // Text colors for different weather conditions
  const textColors = {
    "01d": "text-slate-100",
    "01n": "text-slate-100",
    "02d": "text-slate-100",
    "02n": "text-slate-100",
    "03d": "text-slate-100",
    "03n": "text-slate-100",
    "04d": "text-slate-800",
    "04n": "text-slate-100",
    "09d": "text-slate-100",
    "09n": "text-slate-100",
    "10d": "text-slate-100",
    "10n": "text-slate-100",
    "11d": "text-slate-100",
    "11n": "text-slate-100",
    "13d": "text-slate-800",
    "13n": "text-slate-100",
    "50d": "text-slate-800",
    "50n": "text-slate-100",
  };
  const getTextColor = (icon) => textColors[icon] || "text-slate-100";

  // Sort order for different criteria
  const sortFunctions = {
    lastAdded: (cities) => cities,
    firstAdded: (cities) => cities.reverse(),
    temperature: (a, b, order) =>
      order === "asc" ? a.temp - b.temp : b.temp - a.temp,
    alphabetical: (a, b, order) =>
      order === "asc"
        ? a.cityName.localeCompare(b.cityName)
        : b.cityName.localeCompare(a.cityName),
    humidity: (a, b, order) =>
      order === "asc" ? a.humidity - b.humidity : b.humidity - a.humidity,
    wind: (a, b, order) =>
      order === "asc" ? a.wind - b.wind : b.wind - a.wind,
    clouds: (a, b, order) =>
      order === "asc" ? a.clouds - b.clouds : b.clouds - a.clouds,
    rain: (a, b, order) =>
      order === "asc" ? a.rain - b.rain : b.rain - a.rain,
    snow: (a, b, order) =>
      order === "asc" ? a.snow - b.snow : b.snow - a.snow,
  };

  const sortedCities = useMemo(() => {
    const cities = [...cityNames];

    if (sortCriteria in sortFunctions) {
      const sortFunction = sortFunctions[sortCriteria];
      if (sortCriteria === "lastAdded" || sortCriteria === "firstAdded") {
        return sortFunction(cities);
      } else {
        return cities.sort((a, b) => sortFunction(a, b, sortOrder));
      }
    }
    // If sortCriteria is not found, return the cities as is
    return cities;
  }, [cityNames, sortCriteria, sortOrder]);

  // Loading screen
  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen">
        <p className="text-3xl text-sky-900">Loading cities</p>
        <ProgressBar
          visible={true}
          height="100"
          width="100"
          barColor="#156ED2"
          borderColor="#012B5B"
          ariaLabel="progress-bar-loading"
        />
      </div>
    );
  }

  if (sortedCities.length === 0 && !user.token) {
    return (
      <div className="flex flex-col justify-center items-center h-screen">
        <ImArrowUp className="animate-bounce text-sky-900 h-12 w-12" />
        <p className="text-3xl text-sky-900 text-center">
          Add a city to view the weather forecast or log in to save your cities
        </p>
      </div>
    );
  }

  return (
    <>
      {cityDeleted && (
        <Alert severity="success" className="fixed w-full">
          {cityDeleted}
        </Alert>
      )}
      {typeof sortedCities !== "undefined" && sortedCities.length !== 0 ? (
        <div className="grid grid-cols-1 xs:grid-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 p-3 items-start min-h-screen">
          {sortedCities.map((city) => (
            <div
              key={`${city.latitude}-${city.longitude}`}
              className="rounded-lg shadow-xl m-2 w-auto flex flex-col justify-between items-center text-center min-h-[32rem]"
              style={{
                backgroundImage: `url(${getBackgroundImage(city.icon)})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            >
              <div className="flex flex-col items-center justify-center mt-4">
                <a
                  href={generateGoogleSearchLink(city.cityName)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <div className="flex justify-center items-center mx-2 my-2">
                    {/* City Name */}
                    <Typography
                      variant="h4"
                      align="center"
                      gutterBottom
                      className={`${getTextColor(city.icon)}`}
                    >
                      {city && city.cityName
                        ? city.cityName
                            .split(" ")
                            .map(
                              (word) =>
                                word.charAt(0).toUpperCase() + word.slice(1)
                            )
                            .join(" ")
                        : "City Not Available"}
                      {/* Country Flag */}
                      <ReactCountryFlag
                        className="ml-2"
                        countryCode={city.country}
                        svg
                        title={city.country}
                      />
                    </Typography>
                  </div>
                </a>
                {/* Temperature */}
                <div className="flex flex-col justify-center items-center">
                  <div className="flex justify-center items-center">
                    <Typography
                      variant="h4"
                      align="center"
                      className={`${getTextColor(city.icon)}`}
                    >
                      {formatTemperature(city.temp)}
                    </Typography>
                  </div>
                  <Typography
                    variant="body1"
                    align="center"
                    gutterBottom
                    className={`${getTextColor(city.icon)}`}
                  >
                    Real feel {formatTemperature(city.feels_like)}
                  </Typography>
                </div>

                {/* Weather Description */}
                <div className="flex flex-col justify-center items-center bg-opacity-80 rounded-lg">
                  <img
                    className="w-20 m-1"
                    src={`images/${city.icon}.png`}
                    alt="Weather Icon"
                  />
                  <Typography
                    variant="h6"
                    align="center"
                    className={`${getTextColor(city.icon)}`}
                  >
                    {city.description
                      ? city.description.charAt(0).toUpperCase() +
                        city.description.slice(1)
                      : "Description Not Available"}
                  </Typography>
                </div>
                {/* Weather Details */}
                {boxVisible === city.cityName ? (
                  <FaCircleMinus
                    size={34}
                    onClick={() => toggleBoxVisibility(city.cityName)}
                    className={`cursor-pointer hover:text-slate-500 mt-3 ${getTextColor(
                      city.icon
                    )}`}
                  />
                ) : (
                  <FaCirclePlus
                    size={34}
                    onClick={() => toggleBoxVisibility(city.cityName)}
                    className={`cursor-pointer hover:text-slate-500 mt-3 ${getTextColor(
                      city.icon
                    )}`}
                  />
                )}
                {boxVisible === city.cityName && (
                  <div className="border-2 rounded-lg my-3 mx-3 bg-white bg-opacity-80">
                    {/* Min and Max Temperature */}
                    <div className="flex justify-center items-center">
                      <div className="flex flex-col justify-center items-center my-2 mx-4">
                        <img
                          src="images/thermometerdown1.png"
                          alt="Temperature"
                          className="w-10 h-10 sm:w-12 sm:h-12"
                        />
                        <Typography
                          variant="h6"
                          align="center"
                          gutterBottom
                          className="text-slate-600"
                        >
                          {formatTemperature(city.tempMin)}
                        </Typography>
                      </div>
                      <div className="flex flex-col justify-center items-center my-2 mx-4">
                        <img
                          src="images/thermometerup1.png"
                          alt="Temperature"
                          className="w-10 h-10 sm:w-12 sm:h-12"
                        />
                        <Typography
                          variant="h6"
                          align="center"
                          gutterBottom
                          className="text-slate-600"
                        >
                          {formatTemperature(city.tempMax)}
                        </Typography>
                      </div>
                    </div>
                    {/* Humidity, Wind */}
                    <div className="flex justify-center items-center">
                      <div className="flex flex-col justify-center items-center my-2 mx-4">
                        <img
                          src="images/hygrometer1.png"
                          alt="Humidity"
                          className="w-10 h-10 sm:w-12 sm:h-12"
                        />
                        <Typography
                          variant="h6"
                          align="center"
                          gutterBottom
                          className="text-slate-600"
                        >
                          {city.humidity}%
                        </Typography>
                      </div>
                      <div className="flex flex-col justify-center items-center my-2 mx-4">
                        <img
                          src="images/windsock1.png"
                          alt="Wind"
                          className="w-10 h-10 sm:w-12 sm:h-12"
                        />
                        <Typography
                          variant="h6"
                          align="center"
                          gutterBottom
                          className="text-slate-600"
                        >
                          {city.wind} m/s
                        </Typography>
                      </div>
                    </div>
                    {/* Clouds, Rain, Snow  */}
                    <div className="flex justify-center items-center ">
                      <div className="flex flex-col justify-center items-center my-2 mx-4">
                        <img
                          src="images/cloud1.png"
                          alt="Clouds"
                          className="w-10 h-10 sm:w-12 sm:h-12"
                        />
                        <Typography
                          variant="h6"
                          align="center"
                          gutterBottom
                          className="text-slate-600"
                        >
                          {city.clouds}%
                        </Typography>
                      </div>
                      <div className="flex flex-col  justify-center items-center my-2 mx-4">
                        <img
                          src="images/rain1.png"
                          alt="Rain"
                          className="w-10 h-10 sm:w-12 sm:h-12"
                        />
                        <Typography
                          variant="h6"
                          align="center"
                          gutterBottom
                          className="text-slate-600"
                        >
                          {city.rain || 0} mm
                        </Typography>
                      </div>
                      <div className="flex flex-col justify-center items-center my-2 mx-4">
                        <img
                          src="images/snow1.png"
                          alt="Snow"
                          className="w-10 h-10 sm:w-12 sm:h-12"
                        />
                        <Typography
                          variant="h6"
                          align="center"
                          gutterBottom
                          className="text-slate-600"
                        >
                          {city.snow || 0} mm
                        </Typography>
                      </div>
                    </div>
                    {/* Sunrise and Sunset */}
                    <div className="flex justify-center items-center">
                      <div className="flex flex-col justify-center items-center my-2 mx-4">
                        <img
                          src="images/sunrise1.png"
                          alt="Sunrise"
                          className="w-10 h-10 sm:w-12 sm:h-12"
                        />
                        <Typography
                          variant="h6"
                          align="center"
                          gutterBottom
                          className="text-slate-600"
                        >
                          {city.sunrise}
                        </Typography>
                      </div>
                      <div className="flex flex-col justify-center items-center my-2 mx-4">
                        <img
                          src="images/sunset1.png"
                          alt="Sunset"
                          className="w-10 h-10 sm:w-12 sm:h-12"
                        />
                        <Typography
                          variant="h6"
                          align="center"
                          gutterBottom
                          className="text-slate-600"
                        >
                          {city.sunset}
                        </Typography>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              {/* View Forecast Button */}
              <div className="flex flex-col mb-4">
                <button
                  className="my-2 px-3 py-1 text-lg border-2 border-blue-500 rounded-lg bg-blue-500 text-white hover:text-blue-500 hover:bg-white"
                  onClick={() => handleForecast(city.cityName)}
                >
                  5-Day Forecast
                </button>
                {/* Delete City Button */}
                <button
                  className="my-2 px-3 py-1 text-lg border-2 border-red-500 rounded-lg bg-red-500 text-white hover:text-red-500 hover:bg-white"
                  onClick={() => deleteCityFromUser(city.cityName)}
                >
                  Delete City
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col justify-center items-center h-screen">
          <ImArrowUp className="animate-bounce text-sky-900 h-12 w-12" />
          <p className="text-3xl text-sky-900 text-center">
            Add a city to view the weather forecast
          </p>
        </div>
      )}

      {/* Modal for 5-day forecast */}
      <Modal
        open={isModalOpen}
        onClose={handleCloseModal}
        aria-labelledby="forecast"
        aria-describedby="5dayforecast"
      >
        <Box
          sx={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            bgcolor: "grey.200",
            border: "2px solid #000",
            borderRadius: 10,
            boxShadow: 24,
            p: 4,
            overflow: "scroll",
            width: { xs: "80vw", lg: "80vw" },
            height: { xs: "70vh", lg: "70vh" },
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            border: "1px solid #0E2F44",
          }}
        >
          <div className="w-full overflow-auto">
            {/* City name and subtitle */}
            <Typography
              sx={{ typography: { sm: "h4", xs: "h5" } }}
              align="center"
              gutterBottom
            >
              {selectedCity &&
                selectedCity
                  .split(" ")
                  .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                  .join(" ")}
            </Typography>
            <Typography
              sx={{ typography: { sm: "h6", xs: "body1" } }}
              align="center"
              gutterBottom
            >
              5-Day Forecast
            </Typography>

            {/* Buttons for each day */}
            <div className="flex flex-wrap justify-center mb-4">
              {forecastData &&
                Object.values(
                  forecastData.reduce((acc, forecast) => {
                    const date = forecast.dt_txt.split(" ")[0]; // Extracting date from datetime string
                    if (!acc[date]) {
                      acc[date] = [];
                    }
                    acc[date].push(forecast);
                    return acc;
                  }, {})
                ).map((dailyForecast, index) => (
                  <button
                    key={index}
                    className={`w-44 m-2 text-sm md:text-base md:w-52 ${
                      index === selectedButton
                        ? "bg-custom-blue text-white px-4 py-2 rounded-lg focus:outline-none focus:bg-custom-blue focus:text-white"
                        : "bg-white text-slate-700 px-4 py-2 rounded-lg hover:bg-custom-blue hover:text-white focus:outline-none focus:bg-custom-blue focus:text-white"
                    }`}
                    onClick={() => handleDayClick(dailyForecast, index)}
                  >
                    {getFormattedDate(dailyForecast[0].dt_txt.split(" ")[0])}
                  </button>
                ))}
            </div>

            {/* Forecast data for the selected day */}
            {selectedDayForecast && (
              <div className="flex flex-wrap lg:flex-nowrap justify-center items-center">
                {selectedDayForecast.map((forecast) => (
                  <div
                    key={forecast.dt}
                    className="flex flex-col justify-between items-center m-3 p-3 bg-gradient-to-br from-emerald-100 to-sky-300 rounded-lg shadow-xl"
                    style={{
                      minWidth: "4rem",
                      maxWidth: "6rem",
                      minHeight: "15rem",
                      maxHeight: "15rem",

                      backgroundImage: `url(${getBackgroundImage(
                        forecast.weather[0].icon
                      )})`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }}
                  >
                    {/* Time */}
                    <Typography
                      sx={{ typography: { sm: "h5", xs: "h6" } }}
                      align="center"
                      fontWeight={600}
                      className={`${getTextColor(forecast.weather[0].icon)}`}
                    >
                      {forecast.dt_txt.split(" ")[1].slice(0, 5)}
                    </Typography>

                    {/* Weather Icon */}
                    <img
                      src={`images/${forecast.weather[0].icon}.png`}
                      alt="Weather Icon"
                      className="w-12 m-3 sm:w-16"
                    />

                    {/* Temperature */}
                    <p
                      className={`${getTextColor(
                        forecast.weather[0].icon
                      )} text-2xl font-semibold lg:text-xl xl:text-2xl`}
                    >
                      {formatTemperature(forecast.main.temp)}
                    </p>

                    {/* Description */}
                    <Typography
                      variant="body1"
                      align="center"
                      className={`${getTextColor(forecast.weather[0].icon)}`}
                    >
                      {forecast.weather[0].description.charAt(0).toUpperCase() +
                        forecast.weather[0].description.slice(1)}
                    </Typography>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Box>
      </Modal>
    </>
  );
}

export default City;
