// question 1
//let temp = Number(prompt("Enter the temperature: ")); 
temp=12
if(temp > 30){
console. log("Hot");
}else if(temp >= 20 && temp <= 30){
console. log("Warm");
}else{
console.log("Cold");
}


// question 2
number = 8;

if(number % 2 == 0){
    console.log("The number is even");
}else if(number % 2 !== 0&& number % 5 === 0){
    console.log("The number is odd");
} else{
    console.log("odd number");
}


// question 3
username ="admin"
password ="12345"
if(username==="admin"){
    if(password==="12345"){
        console.log("Welcome");
    }else{
        console.log("Invalid password");
    }
}else{
    console.log("Wrong username or password");
}




//class
score=40
if(score>=90 && score<=100){
    console.log("A*");
}else if(score<=89 && score>=80){
    console.log("A");
} else if(score<=79 && score>=70){
    console.log("B");
} else if(score<=69 && score>=60){
    console.log("C");
} else if(score<=59 && score>=50){
    console.log("D");
} else if(score<=49 && score>=40){
    console.log("E");
} else if(score<=39 && score>=0){
    console.log("F");
}