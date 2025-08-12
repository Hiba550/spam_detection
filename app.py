"""
Legacy Streamlit prototype kept for reference.
Use the Flask app instead: python flask_app.py
"""

import streamlit as st
import pickle
from text_cleaner import TextCleaner  # Assuming your preprocessing is here


@st.cache_resource
def load_model():
    with open("model/spam_model.pkl", "rb") as f:
        model = pickle.load(f)
    return model


pipeline = load_model()

st.title("📩 Spam Message Detector (Legacy Demo)")
user_input = st.text_area("Your message", "")
if st.button("Check"):
    if user_input.strip() == "":
        st.warning("Please enter a message to analyze.")
    else:
        prediction = pipeline.predict([user_input])[0]
        if prediction == 1:
            st.error("⚠️ This message is **SPAM**.")
        else:
            st.success("✅ This message is **NOT spam**.")
