FROM node:alpine
 
WORKDIR /app
 
COPY package*.json ./
RUN npm install
 
COPY . .
 
# Create upload directories
RUN mkdir -p /app/uploads/kyc && chmod -R 777 /app/uploads
 
EXPOSE 3001
 
CMD ["npm", "start"]