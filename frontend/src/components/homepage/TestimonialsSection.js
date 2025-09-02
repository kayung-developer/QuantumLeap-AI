import React from 'react';
import Slider from 'react-slick';
import Card from '../common/Card';

const testimonials = [
  { quote: "QuantumLeap's Visual Builder is a game-changer. I was able to automate my RSI divergence strategy in minutes without writing a single line of code.", name: "Alex Johnson", title: "Day Trader" },
  { quote: "The performance analytics are incredible. Understanding my bot's drawdown and Sharpe Ratio has made me a much more disciplined trader.", name: "Sarah Chen", title: "Swing Trader" },
  { quote: "As a developer, I appreciate the Platform API. But the marketplace is what truly sets this apart. The quality of community strategies is top-notch.", name: "Mike Edwards", title: "Quants Developer" },
  { quote: "I'm new to trading, and being able to subscribe to a proven strategy gave me the confidence to get started. I'm learning so much just by watching it work.", name: "Jessica Lee", title: "New Investor" },
];

const TestimonialsSection = () => {
  const settings = {
    dots: true,
    infinite: true,
    speed: 500,
    slidesToShow: 3,
    slidesToScroll: 1,
    autoplay: true,
    autoplaySpeed: 5000,
    responsive: [
      { breakpoint: 1024, settings: { slidesToShow: 2 } },
      { breakpoint: 640, settings: { slidesToShow: 1 } },
    ],
    dotsClass: "slick-dots !bottom-[-30px]",
  };

  return (
    <section className="bg-light-secondary dark:bg-secondary py-20">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl md:text-4xl font-bold text-light-heading dark:text-white text-center">Trusted by Traders Worldwide</h2>
        <p className="mt-4 text-light-muted dark:text-light-gray max-w-2xl mx-auto text-center">
          Don't just take our word for it. Here's what our users are saying.
        </p>
        <div className="mt-12">
          <Slider {...settings}>
            {testimonials.map((testimonial, index) => (
              <div key={index} className="p-4">
                <Card className="h-full flex flex-col justify-between">
                    <p className="text-light-muted dark:text-light-gray italic">"{testimonial.quote}"</p>
                    <div className="mt-4 text-right">
                        <p className="font-bold text-light-heading dark:text-white">{testimonial.name}</p>
                        <p className="text-sm text-accent">{testimonial.title}</p>
                    </div>
                </Card>
              </div>
            ))}
          </Slider>
        </div>
      </div>
    </section>
  );
};

export default TestimonialsSection;