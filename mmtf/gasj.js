//question 1
let evencount =0;
let oddcount = 0; 
for(i=1 ; i<=350; i++){
    if(i % 2 == 0){
        evencount++
    }else{
        oddcount++
    }
}
console.log('even count is',evencount)
console.log('odd count is',oddcount)




// question 2
let values = [-4, 10, -2, 7, 9, -1];
let positivecount = 0;
for(i=0 ; i<=values.length; i++){
    if(values[i] > 0){
        positivecount++
    }
}
console.log('positive count is',positivecount)


// question 3
let words = ["apple", "banana", "kiwi", "pineapple", "grape", "mango"];
let longcount = 0;
for(let i=0 ; i<words.length; i++){
    if(words[i].length > 5){
        longcount++
    }
}
console.log('long word count is',longcount)


// question 4
let scores = [20, 55, 72, 48, 90, 33, 60,102, 22, 65];
let greater = 0;
for(let i=0 ; i<scores.length; i++){
    if(scores[i] > 50){
        greater++
    }
}
console.log('greater than 50 is',greater)



// question 5
let marks = [35, 50, 80, 22, 68, 49, 100]
let passmarks = 0;
for(i=0 ; i<marks.length; i++){
    if(marks[i] >= 50){
        passmarks++
    }
}
console.log('pass marks sum is',passmarks)